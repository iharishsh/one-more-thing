import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

/** Local constants — avoid Prisma enum re-exports in the instrumentation graph. */
const JobStatus = {
  PENDING: "PENDING",
  CLAIMED: "CLAIMED",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;

const STALE_CLAIM_MS = 2 * 60 * 1000;

export async function enqueueAgentJob(input: {
  runId: string;
  type: string;
  payload?: Prisma.InputJsonValue;
  availableAt?: Date;
}) {
  const job = await prisma.agentJob.create({
    data: {
      runId: input.runId,
      type: input.type,
      payloadJson: input.payload ?? undefined,
      availableAt: input.availableAt ?? new Date(),
      status: JobStatus.PENDING,
    },
  });

  // Nudge the durable worker without awaiting the run (HTTP can return).
  void import("@/server/jobs/agent-worker")
    .then((m) => m.runAgentWorkerOnceForTests())
    .catch(() => undefined);

  return job;
}

/** Claim the next pending job (or reclaim a stuck claim). */
export async function claimNextAgentJob() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);

  return prisma.$transaction(async (tx) => {
    const job = await tx.agentJob.findFirst({
      where: {
        OR: [
          { status: JobStatus.PENDING, availableAt: { lte: now } },
          {
            status: JobStatus.CLAIMED,
            claimedAt: { lt: staleBefore },
          },
        ],
      },
      orderBy: { availableAt: "asc" },
    });
    if (!job) return null;

    const updated = await tx.agentJob.updateMany({
      where: {
        id: job.id,
        OR: [
          { status: JobStatus.PENDING },
          {
            status: JobStatus.CLAIMED,
            claimedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        status: JobStatus.CLAIMED,
        claimedAt: now,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 0) return null;

    return tx.agentJob.findUnique({ where: { id: job.id } });
  });
}

export async function completeAgentJob(jobId: string) {
  await prisma.agentJob.update({
    where: { id: jobId },
    data: { status: JobStatus.DONE },
  });
}

export async function failAgentJob(jobId: string, error: string, retryAt?: Date) {
  if (retryAt) {
    await prisma.agentJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PENDING,
        availableAt: retryAt,
        claimedAt: null,
        lastError: error.slice(0, 500),
      },
    });
    return;
  }

  await prisma.agentJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.FAILED,
      lastError: error.slice(0, 500),
    },
  });
}
