import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/server/supabase/middleware";

const PROTECTED_PREFIXES = ["/workspace", "/api/projects", "/api/changes", "/api/products"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authMode = process.env.AUTH_MODE ?? "demo";

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
    "/api/projects/:path*",
    "/api/changes/:path*",
    "/api/products/:path*",
  ],
};
