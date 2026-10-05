import "server-only";

/** Cap parallel outbound hosted AI calls to reduce provider 429 storms during review. */
const MAX_CONCURRENT =
  Number(process.env.HOSTED_AI_MAX_CONCURRENT ?? "2") || 2;

let inFlight = 0;
const waiters: Array<() => void> = [];

function release() {
  inFlight = Math.max(0, inFlight - 1);
  const next = waiters.shift();
  if (next) next();
}

export async function withHostedAiConcurrency<T>(
  fn: () => Promise<T>,
): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  inFlight += 1;
  try {
    return await fn();
  } finally {
    release();
  }
}
