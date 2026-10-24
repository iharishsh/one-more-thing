import "server-only";

import { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

export type WorkspaceDigest = {
  toReview: number;
  toApprove: number;
  awaitingClient: number;
  awaitingPaymentCents: number;
  paidThisMonthCents: number;
  /** All-time: extra requests that became paid work instead of free work. */
  recoveredCents: number;
  /** Requests confirmed as already covered (no argument, no charge). */
  coveredCount: number;
};

/** Counts behind the one-line workspace digest. Pure DB facts, no AI. */
export async function getWorkspaceDigest(
  ownerId: string,
): Promise<WorkspaceDigest> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const owned = { changeRequest: { project: { ownerId } } };

  const [
    toReview,
    toApprove,
    awaitingClient,
    unpaid,
    paid,
    recovered,
    decided,
  ] = await Promise.all([
    prisma.changeRequest.count({
      where: {
        project: { ownerId, status: "ACTIVE" },
        proposals: { none: {} },
      },
    }),
    prisma.billingAgentAction.count({
      where: { status: "PROPOSED", proposal: owned },
    }),
    prisma.proposal.count({
      where: { ...owned, status: ProposalStatus.PUBLISHED, revokedAt: null },
    }),
    prisma.proposal.aggregate({
      _sum: { priceCents: true },
      where: {
        ...owned,
        status: ProposalStatus.ACCEPTED,
        revokedAt: null,
        payments: { none: { status: PaymentStatus.CAPTURED } },
      },
    }),
    prisma.payment.aggregate({
      _sum: { expectedAmountCents: true },
      where: {
        status: PaymentStatus.CAPTURED,
        updatedAt: { gte: monthStart },
        proposal: owned,
      },
    }),
    prisma.payment.aggregate({
      _sum: { expectedAmountCents: true },
      where: { status: PaymentStatus.CAPTURED, proposal: owned },
    }),
    prisma.changeRequest.findMany({
      where: { project: { ownerId } },
      select: { analysisJson: true },
    }),
  ]);
  const coveredCount = decided.filter(
    (c) =>
      (c.analysisJson as { freelancerDecision?: { kind?: string } } | null)
        ?.freelancerDecision?.kind === "included",
  ).length;

  return {
    toReview,
    toApprove,
    awaitingClient,
    awaitingPaymentCents: unpaid._sum.priceCents ?? 0,
    paidThisMonthCents: paid._sum.expectedAmountCents ?? 0,
    recoveredCents: recovered._sum.expectedAmountCents ?? 0,
    coveredCount,
  };
}
