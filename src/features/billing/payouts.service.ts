import "server-only";

import { z } from "zod";
import {
  BillingActionStatus,
  PaymentStatus,
  type BillingAgentAction,
} from "@/generated/prisma/client";
import {
  buildPayoutArgs,
  checkPayout,
  payoutCents,
  type PayoutArgs,
  type PayoutContext,
} from "@/features/billing/payout-guardrails";
import { recordActivity } from "@/features/projects/project.service";
import { assertProjectOwner } from "@/server/access";
import { prisma } from "@/server/db";
import { formatUsd } from "@/lib/money";
import {
  getPaypalPayoutStatus,
  sendPaypalPayout,
} from "@/server/paypal/agent-toolkit";

export const PAYOUT_TOOL = "send_payout";

export const subcontractorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  paypalEmail: z.email().max(320),
  sharePercent: z.number().int().min(1).max(90),
});

export async function listSubcontractors(projectId: string, ownerId: string) {
  await assertProjectOwner(projectId, ownerId);
  return prisma.subcontractor.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
}

export async function addSubcontractor(
  projectId: string,
  ownerId: string,
  raw: unknown,
) {
  await assertProjectOwner(projectId, ownerId);
  const input = subcontractorSchema.parse(raw);
  const existing = await prisma.subcontractor.aggregate({
    _sum: { sharePercent: true },
    where: { projectId },
  });
  if ((existing._sum.sharePercent ?? 0) + input.sharePercent > 90) {
    throw new Error("Total subcontractor shares can't exceed 90%");
  }
  const sub = await prisma.subcontractor.create({
    data: { ...input, paypalEmail: input.paypalEmail.toLowerCase(), projectId },
  });
  await recordActivity(
    projectId,
    "payout.subcontractor_added",
    `${sub.name} added as a subcontractor (${sub.sharePercent}% of each paid change)`,
    { subcontractorId: sub.id },
  );
  return sub;
}

export async function removeSubcontractor(
  projectId: string,
  ownerId: string,
  subcontractorId: string,
) {
  await assertProjectOwner(projectId, ownerId);
  const sub = await prisma.subcontractor.findFirst({
    where: { id: subcontractorId, projectId },
  });
  if (!sub) throw new Error("Subcontractor not found");
  // Drafts for a removed person can no longer be approved.
  await prisma.billingAgentAction.updateMany({
    where: {
      subcontractorId,
      status: BillingActionStatus.PROPOSED,
    },
    data: { status: BillingActionStatus.REJECTED, decidedAt: new Date() },
  });
  await prisma.subcontractor.delete({ where: { id: sub.id } });
  return { removed: true };
}

async function payoutContext(
  proposalId: string,
  subcontractorId: string | null,
): Promise<PayoutContext & { projectId: string; summary: string }> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      payments: true,
      changeRequest: true,
      billingActions: {
        where: { tool: PAYOUT_TOOL, status: BillingActionStatus.EXECUTED },
      },
    },
  });
  if (!proposal) throw new Error("Proposal not found");
  const sub = subcontractorId
    ? await prisma.subcontractor.findUnique({ where: { id: subcontractorId } })
    : null;
  return {
    proposalId,
    projectId: proposal.changeRequest.projectId,
    summary: proposal.summary,
    priceCents: proposal.priceCents,
    currency: proposal.currency,
    paid: proposal.payments.some((p) => p.status === PaymentStatus.CAPTURED),
    subcontractor:
      sub && sub.projectId === proposal.changeRequest.projectId ? sub : null,
    alreadyPaidOut: proposal.billingActions.some(
      (a) => a.subcontractorId === subcontractorId,
    ),
  };
}

/** After a client pays: draft one payout per subcontractor for approval.
 * Amounts are the agreed share of the paid price, never AI-chosen. */
export async function draftPayouts(
  proposalId: string,
  options: { retryFailed?: boolean } = {},
) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      payments: { where: { status: PaymentStatus.CAPTURED } },
      billingActions: { where: { tool: PAYOUT_TOOL } },
      changeRequest: {
        include: { project: { include: { subcontractors: true } } },
      },
    },
  });
  if (!proposal || proposal.payments.length === 0 || proposal.priceCents <= 0) {
    return [];
  }
  const paidAt = proposal.payments[0].updatedAt;
  const created: BillingAgentAction[] = [];
  for (const sub of proposal.changeRequest.project.subcontractors) {
    // Only changes paid after the subcontractor joined, and only once each.
    if (sub.createdAt > paidAt) continue;
    // Failed payouts are only re-drafted when the freelancer asks to try again.
    const blocking = proposal.billingActions.filter(
      (a) =>
        a.subcontractorId === sub.id &&
        !(options.retryFailed && a.status === BillingActionStatus.FAILED),
    );
    if (blocking.length) continue;

    const ctx = await payoutContext(proposalId, sub.id);
    const amount = payoutCents(proposal.priceCents, sub.sharePercent);
    if (amount <= 0) continue;
    const note = `Your ${sub.sharePercent}% share for "${proposal.summary}" (${proposal.changeRequest.project.title}). Thank you!`;
    const action = await prisma.billingAgentAction.create({
      data: {
        proposalId,
        tool: PAYOUT_TOOL,
        subcontractorId: sub.id,
        argsJson: buildPayoutArgs(ctx, note),
        rationale: `The client paid ${formatUsd(proposal.priceCents)} for this change. ${sub.name}'s agreed share is ${sub.sharePercent}%, so ${formatUsd(amount)} goes to them through PayPal Payouts.`,
        source: "rules",
      },
    });
    created.push(action);
    await recordActivity(
      proposal.changeRequest.projectId,
      "billing.proposed",
      `Payout to ${sub.name} (${formatUsd(amount)}) is ready for your approval`,
      { proposalId, actionId: action.id },
    );
  }
  return created;
}

/** Fire-and-forget after a capture or paid invoice. */
export function draftPayoutsSoon(proposalId: string) {
  setTimeout(() => {
    draftPayouts(proposalId).catch((error) =>
      console.warn("[payouts] draft failed", error),
    );
  }, 0);
}

export async function decidePayoutAction(
  action: BillingAgentAction,
  decision: "approve" | "reject",
) {
  const claimed = await prisma.billingAgentAction.updateMany({
    where: { id: action.id, status: BillingActionStatus.PROPOSED },
    data: {
      status:
        decision === "reject"
          ? BillingActionStatus.REJECTED
          : BillingActionStatus.EXECUTED,
      decidedAt: new Date(),
    },
  });
  if (claimed.count === 0) throw new Error("This action was already decided");
  if (decision === "reject") {
    return { status: "rejected" as const, proposalId: null };
  }

  try {
    const ctx = await payoutContext(action.proposalId, action.subcontractorId);
    // Exclude this action itself (just claimed as EXECUTED) from the double-pay check.
    const others = await prisma.billingAgentAction.count({
      where: {
        tool: PAYOUT_TOOL,
        proposalId: action.proposalId,
        subcontractorId: action.subcontractorId,
        status: BillingActionStatus.EXECUTED,
        id: { not: action.id },
      },
    });
    const check = checkPayout(action.argsJson as Partial<PayoutArgs>, {
      ...ctx,
      alreadyPaidOut: others > 0,
    });
    if (!check.ok) throw new Error(check.error);

    const result = await sendPaypalPayout(check.args);
    await prisma.billingAgentAction.update({
      where: { id: action.id },
      data: { resultJson: { batchId: result.batchId, status: result.status } },
    });
    await recordActivity(
      ctx.projectId,
      "payout.sent",
      `Sent ${check.args.value} ${check.args.currency} to ${ctx.subcontractor?.paypalEmail} via PayPal Payouts`,
      { proposalId: action.proposalId, actionId: action.id, batchId: result.batchId },
    );
    return { status: "executed" as const, proposalId: null };
  } catch (error) {
    await prisma.billingAgentAction.update({
      where: { id: action.id },
      data: {
        status: BillingActionStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export type PayoutRow = {
  id: string;
  status: string;
  subcontractorName: string;
  receiver: string;
  value: string;
  currency: string;
  rationale: string;
  error: string | null;
  paypalStatus: string | null;
};

/** Payout drafts and history for one proposal, with live PayPal batch status. */
export async function getPayoutRows(proposalId: string): Promise<PayoutRow[]> {
  const actions = await prisma.billingAgentAction.findMany({
    where: { proposalId, tool: PAYOUT_TOOL },
    orderBy: { createdAt: "asc" },
  });
  const subs = await prisma.subcontractor.findMany({
    where: { id: { in: actions.flatMap((a) => a.subcontractorId ?? []) } },
  });
  return Promise.all(
    actions.map(async (a) => {
      const args = a.argsJson as Partial<PayoutArgs>;
      const batchId = (a.resultJson as { batchId?: string } | null)?.batchId;
      let paypalStatus: string | null = null;
      if (batchId) {
        paypalStatus = await getPaypalPayoutStatus(batchId).catch(() => null);
      }
      return {
        id: a.id,
        status: a.status,
        subcontractorName:
          subs.find((s) => s.id === a.subcontractorId)?.name ?? "Removed",
        receiver: args.receiver ?? "",
        value: args.value ?? "",
        currency: args.currency ?? "",
        rationale: a.rationale,
        error: a.error,
        paypalStatus,
      };
    }),
  );
}

/** Sweep: draft payouts for paid changes the immediate trigger missed. */
export async function runPayoutSweep(limit = 10) {
  const candidates = await prisma.proposal.findMany({
    where: {
      priceCents: { gt: 0 },
      payments: { some: { status: PaymentStatus.CAPTURED } },
      changeRequest: { project: { subcontractors: { some: {} } } },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  for (const c of candidates) await draftPayouts(c.id);
}

export async function retryFailedPayouts(proposalId: string, ownerId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { changeRequest: { include: { project: true } } },
  });
  if (!proposal || proposal.changeRequest.project.ownerId !== ownerId) {
    throw new Error("Proposal not found");
  }
  return draftPayouts(proposalId, { retryFailed: true });
}
