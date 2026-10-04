import {
  ClientResponseAction,
  PaymentStatus,
  ProposalStatus,
  type Prisma,
} from "@/generated/prisma/client";
import {
  getAnalysis,
  hasCapturedPayment,
} from "@/features/changes/change.service";
import { recordActivity } from "@/features/projects/project.service";
import {
  acceptProposalSchema,
  clientResponseSchema,
  publishProposalSchema,
  type AcceptProposalInput,
  type ClientResponseInput,
  type PublishProposalInput,
} from "@/features/proposals/proposal.schema";
import { canAccept, canRespond } from "@/features/proposals/proposal-state";
import { applyProposalDeliveryChanges } from "@/features/payments/payment.service";
import { getProposalByToken } from "@/server/access";
import { prisma } from "@/server/db";
import { createProposalToken } from "@/lib/tokens";

export async function publishProposal(
  changeId: string,
  ownerId: string,
  raw: PublishProposalInput,
) {
  const input = publishProposalSchema.parse(raw);
  const change = await prisma.changeRequest.findUnique({
    where: { id: changeId },
    include: {
      project: true,
      proposals: {
        orderBy: { version: "desc" },
        include: { payments: { select: { status: true } } },
      },
    },
  });
  if (!change || change.project.ownerId !== ownerId) {
    throw new Error("Change request not found");
  }

  if (hasCapturedPayment(change)) {
    throw new Error(
      "This request already has a paid proposal. Start a new client request for further changes.",
    );
  }

  if (input.optionKind === "extra_price" && input.priceCents <= 0) {
    throw new Error("Set a price for additional paid work before publishing");
  }
  if (
    input.optionKind === "extra_price" &&
    input.deliverableTitles.length === 0
  ) {
    throw new Error("Describe the added work before publishing a paid proposal");
  }

  const analysis = getAnalysis(change);
  const nextVersion = (change.proposals[0]?.version ?? 0) + 1;
  const token = createProposalToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  const termsJson = {
    analysis,
    selectedOption: {
      kind: input.optionKind,
      summary: input.optionSummary,
      priceCents: input.priceCents,
    },
    deliverableChanges: input.deliverableTitles.map((title) => ({ title })),
    completionCriteria: input.completionCriteria ?? null,
    exclusions: input.exclusions ?? null,
    deliveryImpact: input.deliveryImpact ?? null,
    existingWorkNote:
      input.existingWorkNote ??
      "Existing deliverables in the current agreement remain included.",
    deliveryNote: input.deliveryNote ?? null,
    quoteLines: input.quoteLines,
    basedOnScopeVersion: change.scopeVersionAnalyzed,
    proposalRevision: nextVersion,
  } satisfies Prisma.InputJsonValue;

  const published = await prisma.$transaction(async (tx) => {
    // Supersede open / responded versions. Paid proposals are blocked above.
    await tx.proposal.updateMany({
      where: {
        changeRequestId: change.id,
        status: {
          in: [
            ProposalStatus.PUBLISHED,
            ProposalStatus.DRAFT,
            ProposalStatus.DECLINED,
            ProposalStatus.CHANGES_REQUESTED,
            ProposalStatus.ACCEPTED,
          ],
        },
      },
      data: { status: ProposalStatus.SUPERSEDED },
    });

    // Invalidate unpaid open PayPal orders on superseded proposals.
    const superseded = await tx.proposal.findMany({
      where: {
        changeRequestId: change.id,
        status: ProposalStatus.SUPERSEDED,
      },
      select: { id: true },
    });
    if (superseded.length > 0) {
      await tx.payment.updateMany({
        where: {
          proposalId: { in: superseded.map((p) => p.id) },
          status: {
            in: [PaymentStatus.CREATED, PaymentStatus.APPROVED],
          },
        },
        data: { status: PaymentStatus.FAILED },
      });
    }

    return tx.proposal.create({
      data: {
        changeRequestId: change.id,
        version: nextVersion,
        status: ProposalStatus.PUBLISHED,
        summary: input.summary,
        termsJson,
        priceCents: input.priceCents,
        currency: input.currency,
        clientToken: token,
        tokenExpiresAt: expiresAt,
      },
    });
  });

  await recordActivity(
    change.projectId,
    "proposal.published",
    `Published proposal v${nextVersion}${
      input.priceCents > 0
        ? ` for ${input.priceCents / 100} ${input.currency}`
        : " (no extra charge)"
    }`,
    { proposalId: published.id, token: published.clientToken },
  );

  return published;
}

export async function acceptProposal(token: string, raw: AcceptProposalInput) {
  const input = acceptProposalSchema.parse(raw);
  const proposal = await getProposalByToken(token);

  if (!canAccept(proposal.status)) {
    if (proposal.acceptance) {
      return { proposal, alreadyAccepted: true as const };
    }
    throw new Error(`Proposal cannot be accepted in status ${proposal.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const acceptance = await tx.acceptance.create({
      data: {
        proposalId: proposal.id,
        proposalVersion: proposal.version,
        clientName: input.clientName,
        acknowledgment: input.acknowledgment,
      },
    });

    const next = await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: ProposalStatus.ACCEPTED },
      include: {
        acceptance: true,
        payments: true,
        changeRequest: { include: { project: true } },
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId: next.changeRequest.projectId,
        kind: "proposal.accepted",
        message: `Client accepted proposal v${proposal.version}`,
        metadata: { proposalId: proposal.id, acceptanceId: acceptance.id },
      },
    });

    return next;
  });

  // Free changes apply delivery immediately on accept.
  if (updated.priceCents === 0) {
    await applyProposalDeliveryChanges(updated.id);
  }

  return { proposal: updated, alreadyAccepted: false as const };
}

export async function recordClientResponse(
  token: string,
  raw: ClientResponseInput,
) {
  const input = clientResponseSchema.parse(raw);
  const proposal = await getProposalByToken(token);

  if (proposal.acceptance) {
    throw new Error("This proposal was already accepted");
  }
  if (!canRespond(proposal.status)) {
    throw new Error("This proposal is no longer open for responses");
  }

  const action =
    input.action === "decline"
      ? ClientResponseAction.DECLINE
      : ClientResponseAction.REQUEST_CHANGES;
  const nextStatus =
    input.action === "decline"
      ? ProposalStatus.DECLINED
      : ProposalStatus.CHANGES_REQUESTED;
  const kind =
    input.action === "decline"
      ? "proposal.declined"
      : "proposal.changes_requested";
  const message =
    input.action === "decline"
      ? `Client declined proposal v${proposal.version}`
      : `Client requested changes on proposal v${proposal.version}`;

  // Persist response separately — never mutate published termsJson.
  await prisma.$transaction(async (tx) => {
    await tx.clientResponse.create({
      data: {
        proposalId: proposal.id,
        proposalVersion: proposal.version,
        action,
        message: input.message ?? null,
        clientName: input.clientName ?? null,
      },
    });

    await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: nextStatus },
    });

    await tx.activityEvent.create({
      data: {
        projectId: proposal.changeRequest.projectId,
        kind,
        message,
        metadata: {
          proposalId: proposal.id,
          proposalVersion: proposal.version,
          clientName: input.clientName ?? null,
          clientMessage: input.message,
          action: input.action,
        },
      },
    });
  });

  return { ok: true as const, action: input.action };
}
