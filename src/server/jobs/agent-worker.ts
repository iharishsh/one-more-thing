import "server-only";

import { claimNextAgentJob } from "@/server/jobs/agent-queue";

const POLL_MS = 750;
const globalWorker = globalThis as unknown as {
  __omtAgentWorkerStarted?: boolean;
  __omtAgentWorkerTimer?: ReturnType<typeof setInterval>;
};

let tickPromise: Promise<void> | null = null;

async function tick() {
  if (tickPromise) return tickPromise;

  tickPromise = (async () => {
    try {
      // Dynamic import keeps heavy agent/prisma-enum modules out of the
      // instrumentation static graph (Turbopack).
      const { processAgentJob } = await import("@/features/agent/agent-runner");
      for (let i = 0; i < 3; i++) {
        const job = await claimNextAgentJob();
        if (!job) break;
        await processAgentJob({
          id: job.id,
          runId: job.runId,
          type: job.type,
          attempts: job.attempts,
        });
      }
    } catch (error) {
      console.error("[agent-worker]", error);
    }
  })().finally(() => {
    tickPromise = null;
  });

  return tickPromise;
}

/** Durable in-process worker — survives HTTP request completion. */
export function startAgentWorker() {
  if (globalWorker.__omtAgentWorkerStarted) return;
  globalWorker.__omtAgentWorkerStarted = true;
  void tick();
  globalWorker.__omtAgentWorkerTimer = setInterval(() => {
    void tick();
  }, POLL_MS);
  globalWorker.__omtAgentWorkerTimer.unref?.();
}

export async function runAgentWorkerOnceForTests() {
  await tick();
}
