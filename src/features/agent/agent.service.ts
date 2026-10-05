import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  analysisSchema,
  type AnalysisResult,
} from "@/features/changes/analysis.schema";
import {
  canEditChangeRequest,
  getChangeForOwner,
} from "@/features/changes/change.service";
import {
  ACTIVE_RUN_STATUSES,
  AGENT_JOB_PROCESS,
  AGENT_JOB_RESUME,
  approveClarificationSchema,
  clientAnswerSchema,
  pendingClarificationSchema,
} from "@/features/agent/agent.schema";
import { recordActivity } from "@/features/projects/project.service";
import { createProposalToken } from "@/lib/tokens";
import { prisma } from "@/server/db";
import { enqueueAgentJob } from "@/server/jobs/agent-queue";

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

const ACTIVE = [...ACTIVE_RUN_STATUSES] as Array<
  (typeof AgentRunStatus)[keyof typeof AgentRunStatus]
>;

async function ensureThread(changeRequestId: string) {
  const existing = await prisma.changeThread.findUnique({
    where: { changeRequestId },
  });
  if (existing && !existing.revokedAt) return existing;

  if (existing?.revokedAt) {
    return prisma.changeThread.update({
      where: { id: existing.id },
      data: {
        revokedAt: null,
        inviteToken: createProposalToken(),
      },
    });
  }

  return prisma.changeThread.create({
    data: {
      changeRequestId,
      inviteToken: createProposalToken(),
    },
  });
}

export async function startPrepareChange(changeId: string, ownerId: string) {
  const change = await getChangeForOwner(changeId, ownerId);
  if (!canEditChangeRequest(change)) {
    throw new Error(
      "Paid records are locked. Start a new client request for further changes.",
    );
  }

  const active = await prisma.agentRun.findFirst({
    where: {
      changeRequestId: change.id,
      status: { in: ACTIVE },
    },
  });
  if (active) {
    return {
      run: active,
      thread: await ensureThread(change.id),
      alreadyActive: true as const,
    };
  }

  const thread = await ensureThread(change.id);

  await prisma.changeThreadMessage.create({
    data: {
      threadId: thread.id,
      kind: ThreadMessageKind.CLIENT_REQUEST,
      visibility: ThreadMessageVisibility.SHARED,
      body: change.clientMessage,
      idempotencyKey: `request:${change.id}`,
    },
  }).catch(() => undefined);

  const run = await prisma.agentRun.create({
    data: {
      changeRequestId: change.id,
      threadId: thread.id,
      status: AgentRunStatus.QUEUED,
      agreementVersionAtStart: change.project.currentScopeVersion,
      inputRevision: change.analysisRevision,
      maxSteps: 12,
      analysisSnapshotJson: change.analysisJson ?? undefined,
    },
  });

  await enqueueAgentJob({ runId: run.id, type: AGENT_JOB_PROCESS });

  await recordActivity(
    change.projectId,
    "agent.prepare_started",
    "Preparation started",
    { changeRequestId: change.id, runId: run.id },
  );

  return { run, thread, alreadyActive: false as const };
}

export async function getAgentStateForOwner(changeId: string, ownerId: string) {
  const change = await getChangeForOwner(changeId, ownerId);
  const thread = await prisma.changeThread.findUnique({
    where: { changeRequestId: change.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      agentRuns: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  const run =
    thread?.agentRuns.find((r) =>
      (ACTIVE as string[]).includes(r.status) ||
      r.status === AgentRunStatus.DRAFT_READY ||
      r.status === AgentRunStatus.NEEDS_REVIEW,
    ) ?? thread?.agentRuns[0] ?? null;

  const pending = run?.pendingClarificationJson
    ? pendingClarificationSchema.safeParse(run.pendingClarificationJson)
    : null;

  const analysisSnapshot = run?.analysisSnapshotJson
    ? analysisSchema.safeParse(run.analysisSnapshotJson)
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    changeId: change.id,
    thread: thread
      ? {
          id: thread.id,
          inviteToken: thread.inviteToken,
          inviteUrl: `${appUrl}/thread/${thread.inviteToken}`,
          revokedAt: thread.revokedAt,
          autoClarify: thread.autoClarify,
          messages: thread.messages.map((m) => ({
            id: m.id,
            kind: m.kind,
            visibility: m.visibility,
            body: m.body,
            createdAt: m.createdAt,
            metadata: m.metadataJson,
          })),
        }
      : null,
    run: run
      ? {
          id: run.id,
          status: run.status,
          stepCount: run.stepCount,
          draftStale: run.draftStale,
          needsReviewReason: run.needsReviewReason,
          lastError: run.lastError,
          agreementVersionAtStart: run.agreementVersionAtStart,
          agreementVersionChecked: run.agreementVersionChecked,
          pendingClarification: pending?.success ? pending.data : null,
          analysis: analysisSnapshot?.success
            ? (analysisSnapshot.data as AnalysisResult)
            : null,
        }
      : null,
  };
}

export async function approveClarification(
  changeId: string,
  ownerId: string,
  raw: unknown,
) {
  const input = approveClarificationSchema.parse(raw ?? {});
  const change = await getChangeForOwner(changeId, ownerId);
  const run = await prisma.agentRun.findFirst({
    where: {
      changeRequestId: change.id,
      status: AgentRunStatus.WAITING_APPROVAL,
    },
    include: { thread: true },
  });
  if (!run) throw new Error("No clarification waiting for approval");
  if (run.thread.revokedAt) throw new Error("Thread invitation is revoked");

  const pending = pendingClarificationSchema.parse(run.pendingClarificationJson);
  const question = input.editedQuestion?.trim() || pending.question;

  const published = await prisma.changeThreadMessage.create({
    data: {
      threadId: run.threadId,
      kind: ThreadMessageKind.CLARIFICATION_QUESTION,
      visibility: ThreadMessageVisibility.SHARED,
      body: question,
      idempotencyKey: `clarify-q:${run.id}`,
    },
  });

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: AgentRunStatus.WAITING_CLIENT,
      pendingClarificationJson: {
        ...pending,
        question,
        publishedMessageId: published.id,
      },
    },
  });

  await recordActivity(
    change.projectId,
    "agent.clarification_sent",
    "Clarification shared with client",
    { changeRequestId: change.id, runId: run.id },
  );

  return { runId: run.id, question };
}

export async function revokeThreadInvite(changeId: string, ownerId: string) {
  const change = await getChangeForOwner(changeId, ownerId);
  const thread = await prisma.changeThread.findUnique({
    where: { changeRequestId: change.id },
  });
  if (!thread) throw new Error("No thread invitation");

  await prisma.$transaction(async (tx) => {
    await tx.changeThread.update({
      where: { id: thread.id },
      data: { revokedAt: new Date() },
    });
    await tx.agentRun.updateMany({
      where: {
        changeRequestId: change.id,
        status: { in: ACTIVE },
      },
      data: { status: AgentRunStatus.CANCELLED, claimedAt: null },
    });
  });

  await recordActivity(
    change.projectId,
    "agent.thread_revoked",
    "Change-thread invitation revoked",
    { changeRequestId: change.id },
  );

  return { revoked: true };
}

export async function getClientThreadByToken(token: string) {
  const thread = await prisma.changeThread.findUnique({
    where: { inviteToken: token },
    include: {
      changeRequest: { include: { project: true } },
      messages: {
        where: { visibility: ThreadMessageVisibility.SHARED },
        orderBy: { createdAt: "asc" },
      },
      agentRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!thread) return { state: "missing" as const };
  if (thread.revokedAt) return { state: "revoked" as const };

  const run = thread.agentRuns[0] ?? null;
  const waitingForAnswer = run?.status === AgentRunStatus.WAITING_CLIENT;

  return {
    state: "ok" as const,
    projectTitle: thread.changeRequest.project.title,
    waitingForAnswer,
    runStatus: run?.status ?? null,
    messages: thread.messages.map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}

export async function submitClientAnswer(token: string, raw: unknown) {
  const input = clientAnswerSchema.parse(raw);
  const thread = await prisma.changeThread.findUnique({
    where: { inviteToken: token },
    include: {
      agentRuns: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });
  if (!thread) throw new Error("Thread not found");
  if (thread.revokedAt) throw new Error("This invitation has been revoked");

  const waitingRun = thread.agentRuns.find(
    (run) => run.status === AgentRunStatus.WAITING_CLIENT,
  );
  const latestRun = thread.agentRuns[0];
  const run = waitingRun ?? latestRun;
  if (!run) throw new Error("Nothing is waiting for an answer");

  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    `answer:${run.id}:${hashAnswer(input.answer)}`;

  // Idempotent retry: if this key already landed, do not require WAITING_CLIENT.
  const existing = await prisma.changeThreadMessage.findFirst({
    where: { threadId: thread.id, idempotencyKey },
  });
  if (existing) {
    return { accepted: true, duplicate: true };
  }

  if (!waitingRun) {
    throw new Error("Nothing is waiting for an answer");
  }

  try {
    const pendingMeta = waitingRun.pendingClarificationJson
      ? pendingClarificationSchema.safeParse(waitingRun.pendingClarificationJson)
      : null;

    await prisma.changeThreadMessage.create({
      data: {
        threadId: thread.id,
        kind: ThreadMessageKind.CLIENT_ANSWER,
        visibility: ThreadMessageVisibility.SHARED,
        body: input.answer.trim(),
        metadataJson: pendingMeta?.success
          ? {
              relatedItemIds: pendingMeta.data.relatedItemIds,
              relatedClaims: pendingMeta.data.relatedClaims,
            }
          : undefined,
        idempotencyKey,
      },
    });
  } catch (error) {
    if (error instanceof Error && /Unique constraint/i.test(error.message)) {
      return { accepted: true, duplicate: true };
    }
    throw error;
  }

  // Bind resume to the current analysis revision so human edits win.
  const liveChange = await prisma.changeRequest.findUniqueOrThrow({
    where: { id: thread.changeRequestId },
    select: { analysisRevision: true },
  });

  const flipped = await prisma.agentRun.updateMany({
    where: {
      id: waitingRun.id,
      status: AgentRunStatus.WAITING_CLIENT,
    },
    data: {
      status: AgentRunStatus.QUEUED,
      claimedAt: null,
      inputRevision: liveChange.analysisRevision,
    },
  });

  if (flipped.count > 0) {
    const pendingJob = await prisma.agentJob.findFirst({
      where: {
        runId: waitingRun.id,
        type: AGENT_JOB_RESUME,
        status: { in: ["PENDING", "CLAIMED"] },
      },
    });
    if (!pendingJob) {
      await enqueueAgentJob({
        runId: waitingRun.id,
        type: AGENT_JOB_RESUME,
        payload: { answerKey: idempotencyKey } satisfies Prisma.InputJsonValue,
      });
    }
  }

  return { accepted: true, duplicate: false };
}

function hashAnswer(answer: string) {
  let h = 0;
  for (let i = 0; i < answer.length; i++) {
    h = (h * 31 + answer.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

/** Block publish when the agent draft is stale vs current agreement. */
export async function assertAgentDraftPublishable(changeId: string) {
  const run = await prisma.agentRun.findFirst({
    where: {
      changeRequestId: changeId,
      status: AgentRunStatus.DRAFT_READY,
    },
    include: { changeRequest: { include: { project: true } } },
  });
  if (!run) return;

  const current = run.changeRequest.project.currentScopeVersion;
  const checked = run.agreementVersionChecked ?? run.agreementVersionAtStart;
  if (run.draftStale || checked !== current) {
    throw new Error(
      "Agreement changed after this draft. Reassess the request before publishing.",
    );
  }
}
