import { useEffect, useRef } from "react";

const ACTIVE = new Set(["QUEUED", "RUNNING", "WAITING_APPROVAL", "WAITING_CLIENT"]);

export function isAgentRunActive(status: string | null | undefined) {
  return Boolean(status && ACTIVE.has(status));
}

/**
 * Polls fast (every `fastMs`) only while an agent run is active and the tab is
 * visible; otherwise checks roughly every 30s so a run started elsewhere still
 * shows up. `poll` returns whether a run is active.
 */
export function useAgentPoll(
  poll: () => Promise<boolean>,
  deps: unknown[],
  fastMs = 2500,
) {
  const active = useRef(true);
  const idleTicks = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const isActive = await poll();
      if (!cancelled) active.current = isActive;
    };
    void run();
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!active.current) {
        idleTicks.current += 1;
        if (idleTicks.current * fastMs < 30_000) return;
      }
      idleTicks.current = 0;
      void run();
    }, fastMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);
}
