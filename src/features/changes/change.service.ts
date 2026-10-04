import { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";
import {
  analysisSchema,
  derivePrimaryOutcome,
  type AnalysisResult,
} from "@/features/changes/analysis.schema";
import { parseAgreementFacts } from "@/features/changes/agreement-facts";
import {
  createChangeSchema,
  type CreateChangeInput,
} from "@/features/changes/change.schema";
import { recordActivity } from "@/features/projects/project.service";
import { assertProjectOwner } from "@/server/access";
import { enforceEvidence } from "@/server/ai/evidence";
import { runAnalysis } from "@/server/ai/provider";
import { prisma } from "@/server/db";

function analysisActivityMessage(analysis: AnalysisResult) {
  const outcome =
    analysis.primaryOutcome === "clarify"
      ? "needs clarification"
      : analysis.primaryOutcome === "included"
        ? "likely included"
        : analysis.primaryOutcome === "additional"
          ? "possible additional work"
          : "mixed findings";
  if (analysis.source === "fallback") {
    return `Analysis unavailable — needs manual review`;
  }
  if (analysis.source === "ai") {
    return `AI suggested: ${outcome}`;
  }
  return `Needs manual review — classify before acting`;
}

export async function createChangeRequest(
  ownerId: string,
  raw: CreateChangeInput,
) {
  const input = createChangeSchema.parse(raw);
  const project = await assertProjectOwner(input.projectId, ownerId);

  const facts = parseAgreementFacts({
    scope: project.currentScope,
    revisionRoundsTotal: project.revisionRoundsTotal,
    revisionRoundsUsed: project.revisionRoundsUsed,
  });

  // Persist discovered total once so remaining rounds stay consistent.
  if (
    project.revisionRoundsTotal == null &&
    facts.revisionRoundsTotal != null
  ) {
    await prisma.project.update({
      where: { id: project.id },
      data: { revisionRoundsTotal: facts.revisionRoundsTotal },
    });
  }

  const rawAnalysis = await runAnalysis({
    originalScope: project.currentScope,
    clientMessage: input.clientMessage,
    revisionRoundsTotal: facts.revisionRoundsTotal,
    revisionRoundsUsed: facts.revisionRoundsUsed,
    agreementFacts: facts,
  });
  const analysis = enforceEvidence(rawAnalysis, {
    originalScope: project.currentScope,
    clientMessage: input.clientMessage,
  });

  const change = await prisma.changeRequest.create({
    data: {
      projectId: project.id,
      clientMessage: input.clientMessage,
      scopeVersionAnalyzed: project.currentScopeVersion,
      analysisJson: analysis,
    },
  });

  await recordActivity(
    project.id,
    "change.analyzed",
    analysisActivityMessage(analysis),
    {
      changeRequestId: change.id,
      source: analysis.source,
      primaryOutcome: analysis.primaryOutcome,
      remainingRevisionRounds: facts.remainingRevisionRounds,
    },
  );

  return change;
}

export async function getChangeForOwner(changeId: string, ownerId: string) {
  const change = await prisma.changeRequest.findUnique({
    where: { id: changeId },
    include: {
      project: true,
      proposals: {
        orderBy: { version: "desc" },
        include: { acceptance: true, payments: true },
      },
    },
  });
  if (!change || change.project.ownerId !== ownerId) {
    throw new Error("Change request not found");
  }
  return change;
}

export async function updateChangeAnalysis(
  changeId: string,
  ownerId: string,
  analysis: AnalysisResult,
) {
  const change = await getChangeForOwner(changeId, ownerId);
  if (!canEditChangeRequest(change)) {
    throw new Error(
      "Paid records are locked. Start a new client request for further changes.",
    );
  }
  const parsed = analysisSchema.parse(analysis);
  return prisma.changeRequest.update({
    where: { id: change.id },
    data: { analysisJson: parsed },
  });
}

export function hasCapturedPayment(change: {
  proposals: Array<{
    payments: Array<{ status: PaymentStatus | string }>;
  }>;
}) {
  return change.proposals.some((p) =>
    p.payments.some(
      (pay) =>
        pay.status === PaymentStatus.CAPTURED ||
        String(pay.status).toUpperCase() === "CAPTURED",
    ),
  );
}

export function canDeleteChangeRequest(change: {
  proposals: Array<{
    status: ProposalStatus;
    payments: Array<{ status: PaymentStatus }>;
  }>;
}) {
  // Only discard unpublished drafts. Once a proposal was published, keep history
  // and revoke the link instead of hard-deleting.
  return change.proposals.length === 0;
}

export function canRevokeChangeRequest(change: {
  proposals: Array<{
    status: ProposalStatus;
    revokedAt?: Date | null;
    payments: Array<{ status: PaymentStatus }>;
  }>;
}) {
  if (hasCapturedPayment(change)) return false;
  return change.proposals.some(
    (p) =>
      !p.revokedAt &&
      (p.status === ProposalStatus.PUBLISHED ||
        p.status === ProposalStatus.ACCEPTED),
  );
}

/** Paid change requests are immutable — no re-analyze / re-publish. */
export function canEditChangeRequest(change: {
  proposals: Array<{
    payments: Array<{ status: PaymentStatus }>;
  }>;
}) {
  return !hasCapturedPayment(change);
}

export async function deleteChangeRequest(changeId: string, ownerId: string) {
  const change = await getChangeForOwner(changeId, ownerId);

  if (!canDeleteChangeRequest(change)) {
    throw new Error(
      "Published proposals can’t be deleted. Revoke the client link instead.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.changeRequest.delete({ where: { id: change.id } });
    await tx.activityEvent.create({
      data: {
        projectId: change.projectId,
        kind: "change.deleted",
        message: "Deleted an unpublished change request",
        metadata: { changeRequestId: change.id },
      },
    });
  });

  return { projectId: change.projectId };
}

export async function revokeChangeRequest(changeId: string, ownerId: string) {
  const change = await getChangeForOwner(changeId, ownerId);

  if (!canRevokeChangeRequest(change)) {
    throw new Error(
      "Nothing to revoke, or this change already has a captured payment",
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Unpublished / unaccepted: withdraw the proposal entirely.
    await tx.proposal.updateMany({
      where: {
        changeRequestId: change.id,
        status: ProposalStatus.PUBLISHED,
      },
      data: {
        status: ProposalStatus.REVOKED,
        revokedAt: now,
      },
    });

    // Accepted but unpaid: keep acceptance on record; only cut off checkout.
    await tx.proposal.updateMany({
      where: {
        changeRequestId: change.id,
        status: ProposalStatus.ACCEPTED,
      },
      data: {
        revokedAt: now,
        tokenExpiresAt: now,
      },
    });

    await tx.activityEvent.create({
      data: {
        projectId: change.projectId,
        kind: "proposal.revoked",
        message:
          "Withdrew client link (acceptance preserved if already recorded)",
        metadata: { changeRequestId: change.id },
      },
    });
  });

  return { projectId: change.projectId };
}

export function getAnalysis(change: { analysisJson: unknown }): AnalysisResult {
  const parsed = analysisSchema.parse(change.analysisJson ?? {});
  return {
    ...parsed,
    primaryOutcome: derivePrimaryOutcome(parsed),
  };
}
