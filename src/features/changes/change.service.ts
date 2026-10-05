import {
  PaymentStatus,
  Prisma,
  ProposalStatus,
} from "@/generated/prisma/client";
import {
  analysisSchema,
  derivePrimaryOutcome,
  ensureFindingIds,
  type AnalysisResult,
} from "@/features/changes/analysis.schema";
import {
  formatClarificationHistory,
  inheritFindingIds,
  priorItemsFromAnalysis,
  reconcileAnsweredItems,
} from "@/features/changes/analysis-resolve";
import { parseAgreementFacts } from "@/features/changes/agreement-facts";
import {
  enforceUnconfirmedAgreement,
  isAgreementUnconfirmed,
} from "@/features/changes/provisional-agreement";
import {
  addDiscussionContextSchema,
  createChangeSchema,
  type CreateChangeInput,
} from "@/features/changes/change.schema";
import { recordActivity } from "@/features/projects/project.service";
import { assertProjectOwner } from "@/server/access";
import { enforceEvidence } from "@/server/ai/evidence";
import { runAnalysis } from "@/server/ai/provider";
import { prisma } from "@/server/db";
import { createProposalToken } from "@/lib/tokens";

function analysisActivityMessage(analysis: AnalysisResult) {
  const claim =
    analysis.included[0]?.claim ||
    analysis.additional[0]?.claim ||
    analysis.unclear[0]?.claim;
  const short = claim
    ? claim.length > 48
      ? `${claim.slice(0, 48)}…`
      : claim
    : null;

  if (analysis.source === "fallback") {
    return short
      ? `${short} — decide what this is (suggestions unavailable)`
      : "Suggestions unavailable — decide what this is";
  }
  if (analysis.source === "manual") {
    return short
      ? `${short} — decide what this is`
      : "Decide what this is against what’s agreed";
  }
  if (analysis.primaryOutcome === "included") {
    return short ? `${short} ready for review` : "Looks covered — ready for review";
  }
  if (analysis.primaryOutcome === "additional") {
    return short
      ? `${short} — looks like new work`
      : "Looks like new work";
  }
  if (analysis.primaryOutcome === "clarify") {
    return short ? `${short} — need more info` : "Need more info from notes or client";
  }
  return short ? `${short} — mixed request` : "Mixed request — review draft";
}

async function analyzeChangeInput(input: {
  scope: string;
  clientMessage: string;
  discussionNotes?: string | null;
  clarificationHistory?: string | null;
  priorAnalysis?: AnalysisResult | null;
  revisionRoundsTotal?: number | null;
  revisionRoundsUsed?: number;
  agreementStatus?: string | null;
  relatedItemIds?: string[];
  relatedClaims?: string[];
  answerText?: string;
}) {
  const facts = parseAgreementFacts({
    scope: input.scope,
    revisionRoundsTotal: input.revisionRoundsTotal,
    revisionRoundsUsed: input.revisionRoundsUsed,
    agreementStatus: input.agreementStatus,
  });

  const priorItems = priorItemsFromAnalysis(input.priorAnalysis ?? null);
  const rawAnalysis = await runAnalysis({
    originalScope: input.scope,
    clientMessage: input.clientMessage,
    discussionNotes: input.discussionNotes,
    clarificationHistory: input.clarificationHistory,
    priorItems,
    revisionRoundsTotal: facts.revisionRoundsTotal,
    revisionRoundsUsed: facts.revisionRoundsUsed,
    agreementFacts: facts,
  });

  let analysis = enforceEvidence(rawAnalysis, {
    originalScope: input.scope,
    clientMessage: input.clientMessage,
    discussionNotes: input.discussionNotes,
    clarificationHistory: input.clarificationHistory,
  });
  analysis = inheritFindingIds(input.priorAnalysis, analysis);
  analysis = reconcileAnsweredItems(analysis, {
    itemIds: input.relatedItemIds,
    claims: input.relatedClaims,
    answerText: input.answerText,
  });
  analysis = enforceUnconfirmedAgreement(!facts.agreementConfirmed, analysis);
  const priorDecision = input.priorAnalysis?.freelancerDecision;
  analysis = ensureFindingIds({
    ...analysis,
    primaryOutcome: derivePrimaryOutcome(analysis),
    // Saved freelancer decisions outrank background/retry classification,
    // but only while included items remain.
    freelancerDecision:
      priorDecision?.kind === "included" && analysis.included.length > 0
        ? priorDecision
        : analysis.freelancerDecision,
  });

  return { analysis, facts };
}

export async function createChangeRequest(
  ownerId: string,
  raw: CreateChangeInput,
) {
  const input = createChangeSchema.parse(raw);
  const project = await assertProjectOwner(input.projectId, ownerId);

  const { analysis, facts } = await analyzeChangeInput({
    scope: project.currentScope,
    clientMessage: input.clientMessage,
    discussionNotes: input.discussionNotes,
    revisionRoundsTotal: project.revisionRoundsTotal,
    revisionRoundsUsed: project.revisionRoundsUsed,
    agreementStatus: project.agreementStatus,
  });

  if (
    project.revisionRoundsTotal == null &&
    facts.revisionRoundsTotal != null
  ) {
    await prisma.project.update({
      where: { id: project.id },
      data: { revisionRoundsTotal: facts.revisionRoundsTotal },
    });
  }

  const change = await prisma.changeRequest.create({
    data: {
      projectId: project.id,
      clientMessage: input.clientMessage,
      discussionNotes: input.discussionNotes?.trim() || null,
      discussedPriceCents: input.discussedPriceCents ?? null,
      discussedDeliveryNote: input.discussedDeliveryNote?.trim() || null,
      scopeVersionAnalyzed: project.currentScopeVersion,
      analysisJson: analysis,
      analysisRevision: 0,
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
      hasDiscussionNotes: Boolean(input.discussionNotes?.trim()),
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
      changeThread: {
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
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
  let parsed = ensureFindingIds(analysisSchema.parse(analysis));
  // Included decision only remains valid while included items still exist.
  if (
    parsed.freelancerDecision?.kind === "included" &&
    parsed.included.length === 0
  ) {
    parsed = { ...parsed, freelancerDecision: null };
  }

  // Human edit wins: bump revision so in-flight agent writes are rejected.
  const updated = await prisma.changeRequest.update({
    where: { id: change.id },
    data: {
      analysisJson: parsed,
      analysisRevision: { increment: 1 },
    },
  });

  await prisma.agentRun.updateMany({
    where: {
      changeRequestId: change.id,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    data: {
      status: "NEEDS_REVIEW",
      needsReviewReason:
        "You edited the analysis while preparation was running — your edit was kept.",
      claimedAt: null,
    },
  });

  return updated;
}

/**
 * Freelancer-attributed notes / off-platform answers. Never treated as acceptance.
 */
export async function addDiscussionContext(changeId: string, ownerId: string, raw: unknown) {
  const input = addDiscussionContextSchema.parse(raw);
  const change = await getChangeForOwner(changeId, ownerId);
  if (!canEditChangeRequest(change)) {
    throw new Error(
      "Paid records are locked. Start a new client request for further changes.",
    );
  }

  const prior = getAnalysis(change);
  const relatedItem = input.relatedItemId
    ? prior.unclear.find((item) => item.id === input.relatedItemId) ??
      [...prior.included, ...prior.additional, ...prior.unclear].find(
        (item) => item.id === input.relatedItemId,
      )
    : undefined;

  const mergedNotes = [change.discussionNotes?.trim(), input.notes.trim()]
    .filter(Boolean)
    .join("\n\n");

  let threadId = change.changeThread?.id;
  if (!threadId) {
    const created = await prisma.changeThread.create({
      data: {
        changeRequestId: change.id,
        inviteToken: createProposalToken(),
      },
    });
    threadId = created.id;
  }

  await prisma.changeThreadMessage.create({
    data: {
      threadId,
      kind: "FREELANCER_NOTE",
      visibility: "PRIVATE",
      body: input.notes.trim(),
      metadataJson: {
        attribution: "freelancer",
        notAcceptance: true,
        relatedItemId: input.relatedItemId ?? null,
      },
      idempotencyKey: `freelancer-note:${change.id}:${Date.now()}`,
    },
  });

  const messages = await prisma.changeThreadMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
  });
  const clarificationHistory = formatClarificationHistory(messages);

  let analysis = prior;
  if (input.reassess !== false) {
    const result = await analyzeChangeInput({
      scope: change.project.currentScope,
      clientMessage: change.clientMessage,
      discussionNotes: mergedNotes,
      clarificationHistory,
      priorAnalysis: prior,
      revisionRoundsTotal: change.project.revisionRoundsTotal,
      revisionRoundsUsed: change.project.revisionRoundsUsed,
      agreementStatus: change.project.agreementStatus,
      relatedItemIds: input.relatedItemId ? [input.relatedItemId] : undefined,
      relatedClaims: relatedItem ? [relatedItem.claim] : undefined,
      answerText: input.notes,
    });
    analysis = result.analysis;
  }

  const updated = await prisma.changeRequest.update({
    where: { id: change.id },
    data: {
      discussionNotes: mergedNotes,
      discussedPriceCents:
        input.discussedPriceCents ?? change.discussedPriceCents,
      discussedDeliveryNote:
        input.discussedDeliveryNote?.trim() || change.discussedDeliveryNote,
      analysisJson: analysis,
      analysisRevision: { increment: 1 },
      scopeVersionAnalyzed: change.project.currentScopeVersion,
    },
  });

  // Off-platform context closes an in-flight ask without fabricating acceptance.
  await prisma.agentRun.updateMany({
    where: {
      changeRequestId: change.id,
      status: { in: ["WAITING_CLIENT", "WAITING_APPROVAL", "QUEUED", "RUNNING"] },
    },
    data: {
      status: analysis.unclear.length > 0 ? "NEEDS_REVIEW" : "DRAFT_READY",
      needsReviewReason:
        analysis.unclear.length > 0
          ? "Updated from freelancer notes — still has open details"
          : null,
      analysisSnapshotJson: analysis,
      pendingClarificationJson: Prisma.DbNull,
      claimedAt: null,
      inputRevision: updated.analysisRevision,
      draftStale: false,
    },
  });

  await recordActivity(
    change.projectId,
    "change.discussion_notes",
    "Freelancer added discussion notes (not client acceptance)",
    {
      changeRequestId: change.id,
      relatedItemId: input.relatedItemId ?? null,
    },
  );

  return { change: updated, analysis };
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

/**
 * Record an internal “included” decision without publishing a client link.
 * Not acceptance and not a new agreement — Share confirmation remains optional.
 */
export async function markChangeIncluded(
  changeId: string,
  ownerId: string,
  summary?: string,
) {
  const change = await getChangeForOwner(changeId, ownerId);
  if (!canEditChangeRequest(change)) {
    throw new Error(
      "Paid records are locked. Start a new client request for further changes.",
    );
  }
  if (
    isAgreementUnconfirmed({
      agreementStatus: change.project.agreementStatus,
      currentScope: change.project.currentScope,
    })
  ) {
    throw new Error(
      "Record an existing agreement or get a first proposal accepted before marking work as covered",
    );
  }
  const prior = getAnalysis(change);
  if (prior.included.length === 0) {
    throw new Error("Mark at least one item as already covered first");
  }

  const decisionSummary =
    summary?.trim() ||
    prior.included.map((i) => i.claim).filter(Boolean).join("; ") ||
    "Marked as covered by the current agreement";

  const analysis = ensureFindingIds({
    ...prior,
    primaryOutcome: derivePrimaryOutcome(prior),
    freelancerDecision: {
      kind: "included",
      summary: decisionSummary,
      decidedAt: new Date().toISOString(),
    },
  });

  const updated = await prisma.changeRequest.update({
    where: { id: change.id },
    data: {
      analysisJson: analysis,
      analysisRevision: { increment: 1 },
    },
  });

  const short =
    decisionSummary.length > 56
      ? `${decisionSummary.slice(0, 56)}…`
      : decisionSummary;
  await recordActivity(
    change.projectId,
    "change.marked_included",
    `${short} — marked included (internal)`,
    { changeRequestId: change.id },
  );

  return { change: updated, analysis };
}

/** Re-run analysis when an AI provider is configured. */
export async function reanalyzeChange(changeId: string, ownerId: string) {
  const change = await getChangeForOwner(changeId, ownerId);
  if (!canEditChangeRequest(change)) {
    throw new Error(
      "Paid records are locked. Start a new client request for further changes.",
    );
  }

  const provider = process.env.AI_PROVIDER ?? "manual";
  if (provider === "manual") {
    throw new Error("Suggestions aren’t set up — decide covered or new work yourself");
  }

  let clarificationHistory: string | null = null;
  if (change.changeThread) {
    const messages = await prisma.changeThreadMessage.findMany({
      where: { threadId: change.changeThread.id },
      orderBy: { createdAt: "asc" },
    });
    clarificationHistory = formatClarificationHistory(messages);
  }

  const { analysis } = await analyzeChangeInput({
    scope: change.project.currentScope,
    clientMessage: change.clientMessage,
    discussionNotes: change.discussionNotes,
    clarificationHistory,
    priorAnalysis: getAnalysis(change),
    revisionRoundsTotal: change.project.revisionRoundsTotal,
    revisionRoundsUsed: change.project.revisionRoundsUsed,
    agreementStatus: change.project.agreementStatus,
  });

  const updated = await prisma.changeRequest.update({
    where: { id: change.id },
    data: {
      analysisJson: analysis,
      analysisRevision: { increment: 1 },
      scopeVersionAnalyzed: change.project.currentScopeVersion,
    },
  });

  await recordActivity(
    change.projectId,
    "change.analyzed",
    analysisActivityMessage(analysis),
    {
      changeRequestId: change.id,
      source: analysis.source,
      primaryOutcome: analysis.primaryOutcome,
      retried: true,
    },
  );

  return { change: updated, analysis };
}

export function getAnalysis(change: { analysisJson: unknown }): AnalysisResult {
  const parsed = analysisSchema.parse(change.analysisJson ?? {});
  return ensureFindingIds({
    ...parsed,
    primaryOutcome: derivePrimaryOutcome(parsed),
  });
}
