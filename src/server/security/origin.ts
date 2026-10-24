const LOCAL_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function allowedOrigins(): Set<string> {
  const out = new Set(LOCAL_ORIGINS);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      out.add(new URL(appUrl).origin);
    } catch {
      // ignore malformed env in tests
    }
  }
  const extra = process.env.CSRF_ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const origin of extra ?? []) {
    try {
      out.add(new URL(origin).origin);
    } catch {
      out.add(origin);
    }
  }
  return out;
}

export function isMutationMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

/** Paths that must not require browser Origin (server-to-server). */
export function isCsrfExemptPath(pathname: string) {
  return pathname === "/api/paypal/webhook";
}

/**
 * Browser mutation CSRF check: Origin/Referer must match app URL (or localhost in dev).
 * Same-origin fetches without Origin still pass via Sec-Fetch-Site.
 */
/** Dev servers often run on another port (e.g. `next dev -p 3010`). */
const DEV_LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

function isAllowedOrigin(allowed: Set<string>, origin: string) {
  if (allowed.has(origin)) return true;
  return (
    process.env.NODE_ENV !== "production" && DEV_LOCAL_ORIGIN.test(origin)
  );
}

export function verifyMutationOrigin(headers: Headers): boolean {
  const allowed = allowedOrigins();
  const origin = headers.get("origin");
  if (origin) return isAllowedOrigin(allowed, origin);

  const referer = headers.get("referer");
  if (referer) {
    try {
      return isAllowedOrigin(allowed, new URL(referer).origin);
    } catch {
      return false;
    }
  }

  const site = headers.get("sec-fetch-site");
  return site === "same-origin" || site === "same-site";
}
