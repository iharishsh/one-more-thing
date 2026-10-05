export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/server/env");
    getEnv();

    try {
      // Durable agent job worker (DB-backed; not tied to an open browser tab).
      const { startAgentWorker } = await import("@/server/jobs/agent-worker");
      startAgentWorker();
    } catch (error) {
      console.error("[instrumentation] agent worker failed to start", error);
    }
  }
}
