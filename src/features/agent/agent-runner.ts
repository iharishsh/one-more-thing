import "server-only";

import { Prisma } from "@/generated/prisma/client";
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
  AGENT_JOB_RESUME,
  MAX_AGENT_JOB_ATTEMPTS,
  MAX_AGENT_STEPS,
  pendingClarificationSchema,
  type PendingClarification,
} from "@/features/agent/agent.schema";
import { recordActivity } from "@/features/projects/project.service";
import { enforceEvidence } from "@/server/ai/evidence";
import { runAnalysis } from "@/server/ai/provider";
import { prisma } from "@/server/db";
import {
  completeAgentJob,
  failAgentJob,
} from "@/server/jobs/agent-queue";

const AgentRunStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  WAITING_APPROVAL: "WAITING_APPROVAL",
  WAITING_CLIENT: "WAITING_CLIENT",
  DRAFT_READY: "DRAFT_READY",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

const ThreadMessageKind = {
  SYSTEM: "SYSTEM",
  CLIENT_REQUEST: "CLIENT_REQUEST",
  CLARIFICATION_DRAFT: "CLARIFICATION_DRAFT",
  CLARIFICATION_QUESTION: "CLARIFICATION_QUESTION",
  CLIENT_ANSWER: "CLIENT_ANSWER",
  FREELANCER_NOTE: "FREELANCER_NOTE",
  ACTIVITY: "ACTIVITY",
  DRAFT_SUMMARY: "DRAFT_SUMMARY",
} as const;

const ThreadMessageVisibility = {
  SHARED: "SHARED",
  PRIVATE: "PRIVATE",
} as const;

type MessageKind = (typeof ThreadMessageKind)[keyof typeof ThreadMessageKind];
type MessageVisibility =
  (typeof ThreadMessageVisibility)[keyof typeof ThreadMessageVisibility];

async function appendMessage(input: {
  threadId: string;
  kind: MessageKind;
  visibility: MessageVisibility;
  body: string;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey?: string;
}) {
  try {
    return await prisma.changeThreadMessage.create({
      data: {
        threadId: input.threadId,
        kind: input.kind,
        visibility: input.visibility,
        body: input.body,
        metadataJson: input.metadata,
        idempotencyKey: input.idempotencyKey,
      },
    });
  } catch (error) {
    if (
      input.idempotencyKey &&
      error instanceof Error &&
      /Unique constraint/i.test(error.message)
    ) {
      return prisma.changeThreadMessage.findFirst({
        where: {
          threadId: input.threadId,
          idempotencyKey: input.idempotencyKey,
        },
      });
    }
    throw error;
  }
}

function pickClarification(analysis: AnalysisResult): PendingClarification | null {
  const unclear = analysis.unclear.filter((item) =>
    item.clarificationQuestion?.trim(),
  );
  if (unclear.length === 0) return null;
  const first = unclear[0]!;
  return {
    question: first.clarificationQuestion!.trim(),
    relatedClaims: unclear.map((item) => item.claim),
    relatedItemIds: unclear
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id)),
  };
}

function draftSummary(analysis: AnalysisResult) {
  const parts: string[] = [];
  if (analysis.included.length) {
    parts.push(
      `Included (${analysis.included.length}): ${analysis.included
        .map((i) => i.claim)
        .join("; ")}`,
    );
  }
  if (analysis.additional.length) {
    parts.push(
      `Additional (${analysis.additional.length}): ${analysis.additional
        .map((i) => i.claim)
        .join("; ")} — price/date still need your confirmation`,
    );
  }
  if (analysis.unclear.length) {
    parts.push(
      `Still needs detail (${analysis.unclear.length}): ${analysis.unclear
        .map((i) => i.claim)
        .join("; ")}`,
    );
  }
  return parts.join("\n") || "Ready to review.";
}

async function markNeedsReview(runId: string, reason: string) {
  const run = await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: AgentRunStatus.NEEDS_REVIEW,
      needsReviewReason: reason,
      claimedAt: null,
    },
    include: { changeRequest: true },
  });

  await appendMessage({
    threadId: run.threadId,
    kind: ThreadMessageKind.ACTIVITY,
    visibility: ThreadMessageVisibility.PRIVATE,
    body: `Needs your review: ${reason}`,
    idempotencyKey: `needs-review:${runId}:${reason.slice(0, 40)}`,
  });
  await recordActivity(
    run.changeRequest.projectId,
    "agent.needs_review",
    "Preparation needs your review",
    { changeRequestId: run.changeRequestId, runId, reason },
  );
}

function priorFromJson(value: unknown): AnalysisResult | null {
  const parsed = analysisSchema.safeParse(value ?? {});
  if (!parsed.success) return null;
  return ensureFindingIds({
    ...parsed.data,
    primaryOutcome: derivePrimaryOutcome(parsed.data),
  });
}

export async function processAgentJob(job: {
  id: string;
  runId: string;
  type: string;
  attempts: number;
}) {
  if (job.attempts > MAX_AGENT_JOB_ATTEMPTS) {
    await markNeedsReview(job.runId, "Job attempts exhausted");
    await failAgentJob(job.id, "Max attempts exceeded");
    return;
  }

  const run = await prisma.agentRun.findUnique({
    where: { id: job.runId },
    include: {
      thread: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      changeRequest: { include: { project: true } },
    },
  });

  if (!run) {
    await completeAgentJob(job.id);
    return;
  }

  if (
    run.status !== AgentRunStatus.QUEUED &&
    run.status !== AgentRunStatus.RUNNING
  ) {
    await completeAgentJob(job.id);
    return;
  }

  const boundRevision = run.inputRevision;

  try {
    if (run.stepCount >= MAX_AGENT_STEPS) {
      await markNeedsReview(run.id, "Step limit reached");
      await completeAgentJob(job.id);
      return;
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: AgentRunStatus.RUNNING,
        claimedAt: new Date(),
        stepCount: { increment: 1 },
      },
    });

    // Re-read revision after claim — reject stale runs if human edited.
    const live = await prisma.changeRequest.findUniqueOrThrow({
      where: { id: run.changeRequestId },
      select: { analysisRevision: true, analysisJson: true, discussionNotes: true, clientMessage: true },
    });
    if (live.analysisRevision !== boundRevision) {
      await markNeedsReview(
        run.id,
        "You edited the analysis while preparation was running — your edit was kept.",
      );
      await completeAgentJob(job.id);
      return;
    }

    const project = run.changeRequest.project;
    const agreementVersion = project.currentScopeVersion;

    if (
      job.type === AGENT_JOB_RESUME &&
      agreementVersion !== run.agreementVersionAtStart
    ) {
      await appendMessage({
        threadId: run.threadId,
        kind: ThreadMessageKind.ACTIVITY,
        visibility: ThreadMessageVisibility.PRIVATE,
        body: `Agreement changed (v${run.agreementVersionAtStart} → v${agreementVersion}). Reassessing.`,
        idempotencyKey: `reassess:${run.id}:v${agreementVersion}`,
      });
    }

    await appendMessage({
      threadId: run.threadId,
      kind: ThreadMessageKind.ACTIVITY,
      visibility: ThreadMessageVisibility.PRIVATE,
      body: `Compared request with agreement v${agreementVersion}.`,
      idempotencyKey: `compared:${run.id}:s${run.stepCount + 1}:v${agreementVersion}`,
    });

    const clarificationHistory = formatClarificationHistory(run.thread.messages);
    const prior =
      priorFromJson(run.analysisSnapshotJson) ??
      priorFromJson(live.analysisJson);
    const priorPending = run.pendingClarificationJson
      ? pendingClarificationSchema.safeParse(run.pendingClarificationJson)
      : null;

    const facts = parseAgreementFacts({
      scope: project.currentScope,
      revisionRoundsTotal: project.revisionRoundsTotal,
      revisionRoundsUsed: project.revisionRoundsUsed,
      agreementStatus: project.agreementStatus,
    });

    const rawAnalysis = await runAnalysis({
      originalScope: project.currentScope,
      clientMessage: live.clientMessage,
      discussionNotes: live.discussionNotes,
      clarificationHistory,
      priorItems: priorItemsFromAnalysis(prior),
      revisionRoundsTotal: facts.revisionRoundsTotal,
      revisionRoundsUsed: facts.revisionRoundsUsed,
      agreementFacts: facts,
    });

    let normalized = enforceEvidence(rawAnalysis, {
      originalScope: project.currentScope,
      clientMessage: live.clientMessage,
      discussionNotes: live.discussionNotes,
      clarificationHistory,
    });
    normalized = inheritFindingIds(prior, normalized);
    if (priorPending?.success) {
      const lastAnswer = [...run.thread.messages]
        .reverse()
        .find(
          (m) =>
            m.kind === ThreadMessageKind.CLIENT_ANSWER ||
            m.kind === ThreadMessageKind.FREELANCER_NOTE,
        );
      normalized = reconcileAnsweredItems(normalized, {
        itemIds: priorPending.data.relatedItemIds,
        claims: priorPending.data.relatedClaims,
        answerText: lastAnswer?.body,
      });
    }
    normalized = enforceUnconfirmedAgreement(
      isAgreementUnconfirmed({
        agreementStatus: project.agreementStatus,
        currentScope: project.currentScope,
      }),
      normalized,
    );
    const priorDecision = priorFromJson(live.analysisJson)?.freelancerDecision;
    normalized = ensureFindingIds({
      ...normalized,
      primaryOutcome: derivePrimaryOutcome(normalized),
      // Human mark-included is not overwritten by the agent while included items remain.
      freelancerDecision:
        priorDecision?.kind === "included" && normalized.included.length > 0
          ? priorDecision
          : normalized.freelancerDecision,
    });

    // Atomic revision check + write — separate read-then-write can still race.
    const write = await prisma.changeRequest.updateMany({
      where: {
        id: run.changeRequestId,
        analysisRevision: boundRevision,
      },
      data: {
        analysisJson: normalized,
        scopeVersionAnalyzed: agreementVersion,
      },
    });
    if (write.count === 0) {
      await markNeedsReview(
        run.id,
        "You edited the analysis while preparation was running — your edit was kept.",
      );
      await completeAgentJob(job.id);
      return;
    }

    const hasClientAnswer = run.thread.messages.some(
      (m) =>
        m.kind === ThreadMessageKind.CLIENT_ANSWER ||
        m.kind === ThreadMessageKind.FREELANCER_NOTE,
    );
    const answeredItemIds = new Set(priorPending?.success ? priorPending.data.relatedItemIds : []);
    const pending = pickClarification(normalized);

    // Ask only for material gaps that were not just answered.
    const shouldAsk =
      pending &&
      !hasClientAnswer &&
      pending.relatedItemIds.every((id) => !answeredItemIds.has(id));

    // After an answer, only re-ask if remaining unclear items are NEW (not the ones just answered).
    const remainingAfterAnswer =
      pending &&
      hasClientAnswer &&
      pending.relatedItemIds.some((id) => !answeredItemIds.has(id)) &&
      normalized.unclear.some(
        (item) => item.id && !answeredItemIds.has(item.id),
      );

    if (shouldAsk && pending) {
      const draft = await appendMessage({
        threadId: run.threadId,
        kind: ThreadMessageKind.CLARIFICATION_DRAFT,
        visibility: ThreadMessageVisibility.PRIVATE,
        body: pending.question,
        metadata: {
          relatedClaims: pending.relatedClaims,
          relatedItemIds: pending.relatedItemIds,
        },
        idempotencyKey: `clarify-draft:${run.id}`,
      });

      await appendMessage({
        threadId: run.threadId,
        kind: ThreadMessageKind.ACTIVITY,
        visibility: ThreadMessageVisibility.PRIVATE,
        body: "Missing details that affect scope/price/delivery — draft a question, or add what you already discussed.",
        idempotencyKey: `clarify-activity:${run.id}`,
      });

      const clarification: PendingClarification = {
        ...pending,
        draftMessageId: draft?.id,
      };

      if (run.thread.autoClarify) {
        const published = await appendMessage({
          threadId: run.threadId,
          kind: ThreadMessageKind.CLARIFICATION_QUESTION,
          visibility: ThreadMessageVisibility.SHARED,
          body: pending.question,
          idempotencyKey: `clarify-q:${run.id}`,
        });
        await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: AgentRunStatus.WAITING_CLIENT,
            analysisSnapshotJson: normalized,
            pendingClarificationJson: {
              ...clarification,
              publishedMessageId: published?.id,
            },
            agreementVersionChecked: agreementVersion,
            draftStale: false,
            claimedAt: null,
          },
        });
      } else {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: AgentRunStatus.WAITING_APPROVAL,
            analysisSnapshotJson: normalized,
            pendingClarificationJson: clarification,
            agreementVersionChecked: agreementVersion,
            draftStale: false,
            claimedAt: null,
          },
        });
      }

      await recordActivity(
        project.id,
        "agent.waiting_clarification",
        "Waiting on clarification (optional client handoff)",
        { changeRequestId: run.changeRequestId, runId: run.id },
      );
      await completeAgentJob(job.id);
      return;
    }

    if (
      hasClientAnswer &&
      normalized.primaryOutcome === "clarify" &&
      normalized.included.length === 0 &&
      normalized.additional.length === 0
    ) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          analysisSnapshotJson: normalized,
          agreementVersionChecked: agreementVersion,
        },
      });
      await markNeedsReview(
        run.id,
        remainingAfterAnswer
          ? "Still missing material details after the answer — review or ask a targeted question"
          : "Still unclear after the answer — review manually",
      );
      await completeAgentJob(job.id);
      return;
    }

    const summary = draftSummary(normalized);
    await appendMessage({
      threadId: run.threadId,
      kind: ThreadMessageKind.DRAFT_SUMMARY,
      visibility: ThreadMessageVisibility.PRIVATE,
      body: summary,
      idempotencyKey: `draft-summary:${run.id}:v${agreementVersion}`,
    });

    await appendMessage({
      threadId: run.threadId,
      kind: ThreadMessageKind.ACTIVITY,
      visibility: ThreadMessageVisibility.PRIVATE,
      body:
        normalized.unclear.length > 0
          ? "Ready to review — some items still need detail. Ready to publish only after you finish terms for the items you choose."
          : "Ready to review. Confirm included work or prepare terms for additional work.",
      idempotencyKey: `draft-ready:${run.id}:v${agreementVersion}`,
    });

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status:
          normalized.unclear.length > 0
            ? AgentRunStatus.NEEDS_REVIEW
            : AgentRunStatus.DRAFT_READY,
        analysisSnapshotJson: normalized,
        pendingClarificationJson: Prisma.DbNull,
        agreementVersionChecked: agreementVersion,
        draftStale: agreementVersion !== run.agreementVersionAtStart,
        claimedAt: null,
        needsReviewReason:
          normalized.unclear.length > 0
            ? "Ready to review — some items still need detail"
            : null,
      },
    });

    const readyClaim =
      normalized.included[0]?.claim ||
      normalized.additional[0]?.claim ||
      normalized.unclear[0]?.claim;
    const readyMsg = readyClaim
      ? `${readyClaim.length > 48 ? `${readyClaim.slice(0, 48)}…` : readyClaim} ready for review`
      : "Ready for review";
    await recordActivity(project.id, "agent.draft_ready", readyMsg, {
      changeRequestId: run.changeRequestId,
      runId: run.id,
      primaryOutcome: normalized.primaryOutcome,
      agreementVersion,
      unresolved: normalized.unclear.length,
    });

    await completeAgentJob(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent failed";
    if (job.attempts >= MAX_AGENT_JOB_ATTEMPTS) {
      await markNeedsReview(job.runId, message);
      await failAgentJob(job.id, message);
      return;
    }
    await failAgentJob(
      job.id,
      message,
      new Date(Date.now() + Math.min(30_000, 2000 * Math.max(1, job.attempts))),
    );
    await prisma.agentRun.update({
      where: { id: job.runId },
      data: {
        status: AgentRunStatus.QUEUED,
        lastError: message.slice(0, 500),
        claimedAt: null,
      },
    });
  }
}
