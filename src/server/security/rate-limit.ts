type Bucket = "ai" | "auth" | "api";

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

const LIMITS: Record<Bucket, { max: number; windowMs: number }> = {
  /** Prepare / reanalyze / agent / analyze / refine / product search */
  ai: { max: 40, windowMs: 60_000 },
  /** Demo login brute-force guard */
  auth: { max: 20, windowMs: 60_000 },
  /** Other authenticated / public POST APIs */
  api: { max: 120, windowMs: 60_000 },
};

export function rateLimitBucketForPath(pathname: string): Bucket {
  if (pathname.startsWith("/api/auth/")) return "auth";
  if (
    pathname.includes("/prepare") ||
    pathname.includes("/reanalyze") ||
    pathname.includes("/agent") ||
    pathname.endsWith("/analyze") ||
    pathname.startsWith("/api/products/search") ||
    pathname.startsWith("/api/projects/refine") ||
    // Public client requests trigger AI analysis.
    pathname.startsWith("/api/intake/")
  ) {
    return "ai";
  }
  return "api";
}

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

export function checkRateLimit(key: string, bucket: Bucket): RateLimitResult {
  const { max, windowMs } = LIMITS[bucket];
  const now = Date.now();
  const compound = `${bucket}:${key}`;
  let entry = store.get(compound);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(compound, entry);
  }
  entry.count += 1;
  const remaining = Math.max(0, max - entry.count);
  if (entry.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: false, remaining: 0, resetAt: entry.resetAt, retryAfterSec };
  }
  return { ok: true, remaining, resetAt: entry.resetAt };
}

/** @internal test helper */
export function resetRateLimitStoreForTests() {
  store.clear();
}
