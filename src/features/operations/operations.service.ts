import {
  PaymentStatus,
  ProposalStatus,
} from "@/generated/prisma/client";
import { getAnalysis } from "@/features/changes/change.service";
import { prisma } from "@/server/db";

export type OperationsRow = {
  id: string;
  projectId: string;
  projectTitle: string;
  clientRequest: string;
  scopeFinding: string;
  agreement: string;
  amountCents: number | null;
  payment: string;
  nextAction: string;
  href: string;
};

function findingLabel(change: { analysisJson: unknown; proposals: unknown[] }) {
  try {
    const analysis = getAnalysis(change);
    if (analysis.primaryOutcome === "clarify") return "Need more info";
    if (analysis.primaryOutcome === "included") return "Looks covered";
    if (analysis.primaryOutcome === "additional") return "Looks like new work";
    if (analysis.primaryOutcome === "mixed") return "Mixed request";
  } catch {
    /* ignore */
  }
  return "Needs a look";
}

export async function listOperationsRows(
  ownerId: string,
): Promise<OperationsRow[]> {
  const changes = await prisma.changeRequest.findMany({
    where: { project: { ownerId } },
    include: {
      project: { select: { id: true, title: true } },
      proposals: {
        orderBy: { version: "desc" },
        take: 1,
        include: { acceptance: true, payments: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return changes.map((change) => {
    const latest = change.proposals[0];
    const paid = latest?.payments.some(
      (p) => p.status === PaymentStatus.CAPTURED,
    );
    const accepted = Boolean(latest?.acceptance);
    const finding = findingLabel(change);

    let agreement = "Not proposed yet";
    let payment = "—";
    let nextAction = "Review request";
    let amountCents: number | null = null;

    if (!latest) {
      if (finding === "Need more info") nextAction = "Ask the client";
      else if (finding === "Looks covered") nextAction = "Mark as covered";
      else if (finding === "Looks like new work") nextAction = "Send a paid proposal";
      agreement = "No proposal yet";
    } else {
      amountCents = latest.priceCents;
      if (paid) {
        agreement = "Accepted";
        payment = "Paid";
        nextAction = "Start agreed work";
      } else if (accepted) {
        agreement = "Accepted";
        payment =
          latest.priceCents > 0 ? "Awaiting payment" : "No charge";
        nextAction =
          latest.priceCents > 0 ? "Follow up on payment" : "Start agreed work";
      } else if (latest.status === ProposalStatus.PUBLISHED) {
        agreement = "Awaiting client";
        payment = latest.priceCents > 0 ? "Not started" : "No charge";
        nextAction = "Await client response";
      } else if (latest.status === ProposalStatus.DECLINED) {
        agreement = "Declined";
        payment = "—";
        nextAction = "Revise and republish";
      } else if (latest.status === ProposalStatus.CHANGES_REQUESTED) {
        agreement = "Changes requested";
        payment = "—";
        nextAction = "Revise and republish";
      } else if (latest.status === ProposalStatus.REVOKED || latest.revokedAt) {
        agreement = "Withdrawn";
        payment = "—";
        nextAction = "Revise if needed";
      } else {
        agreement = latest.status;
        payment = "—";
        nextAction = "Open request";
      }
    }

    return {
      id: change.id,
      projectId: change.project.id,
      projectTitle: change.project.title,
      clientRequest: change.clientMessage,
      scopeFinding: finding,
      agreement,
      amountCents,
      payment,
      nextAction,
      href: `/workspace/projects/${change.project.id}/changes/${change.id}`,
    };
  });
}
