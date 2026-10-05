import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/server/supabase/middleware";
import {
  isCsrfExemptPath,
  isMutationMethod,
  verifyMutationOrigin,
} from "@/server/security/origin";
import {
  checkRateLimit,
  rateLimitBucketForPath,
} from "@/server/security/rate-limit";

const PROTECTED_PREFIXES = ["/workspace", "/api/projects", "/api/changes", "/api/products"];

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authMode = process.env.AUTH_MODE ?? "demo";

  if (pathname.startsWith("/api/") && isMutationMethod(request.method)) {
    if (!isCsrfExemptPath(pathname)) {
      if (!verifyMutationOrigin(request.headers)) {
        return NextResponse.json(
          { error: "Cross-site request blocked (invalid Origin)" },
          { status: 403 },
        );
      }
    }
    const bucket = rateLimitBucketForPath(pathname);
    const limit = checkRateLimit(clientIp(request), bucket);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests — slow down and retry" },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        },
      );
    }
  }

  let response =
    authMode === "supabase"
      ? await updateSupabaseSession(request)
      : NextResponse.next({ request });

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) {
    return response;
  }

  if (authMode === "demo") {
    const demo = request.cookies.get("omt_demo_user")?.value;
    if (!demo) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Demo login required" }, { status: 401 });
      }
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return response;
  }

  // Supabase: cookie presence is refreshed above; API routes still call requireFreelancer.
  // Page routes without session → login.
  if (!pathname.startsWith("/api/")) {
    const hasSession =
      request.cookies.getAll().some((c) => c.name.includes("auth-token")) ||
      request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
    if (!hasSession) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/workspace",
    "/workspace/:path*",
    "/api/:path*",
  ],
};
