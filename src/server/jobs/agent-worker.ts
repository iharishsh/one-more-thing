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

const SWEEP_MS = 60_000;
let sweepPromise: Promise<void> | null = null;

/** Payment follow-up: records paid invoices and drafts next steps for approval. */
async function sweep() {
  if (sweepPromise) return sweepPromise;
  sweepPromise = (async () => {
    try {
      const { runBillingSweep } = await import(
        "@/features/billing/billing-agent.service"
      );
      await runBillingSweep();
      const { runPayoutSweep } = await import("@/features/billing/payouts.service");
      await runPayoutSweep();
      const { backfillProjectSummaries } = await import(
        "@/features/projects/project-summary"
      );
      await backfillProjectSummaries();
    } catch (error) {
      console.error("[billing-sweep]", error);
    }
  })().finally(() => {
    sweepPromise = null;
  });
  return sweepPromise;
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
  setInterval(() => {
    void sweep();
  }, SWEEP_MS).unref?.();
}

export async function runAgentWorkerOnceForTests() {
  await tick();
}
