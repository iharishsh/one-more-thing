import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { getEnv, isDemoAuthMode } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const DEMO_FREELANCER_A = "freelancer@example.com";
export const DEMO_FREELANCER_B = "freelancer-b@example.com";
export const DEMO_SESSION_COOKIE = "omt_demo_user";

/**
 * Resolves the current freelancer.
 * - AUTH_MODE=supabase: requires a Supabase session; maps auth.users → User (no seed fallback).
 * - AUTH_MODE=demo: requires explicit demo session cookie set via /login (never silent default).
 */
export async function requireFreelancer() {
  getEnv();

  if (isDemoAuthMode()) {
    return requireDemoFreelancer();
  }

  return requireSupabaseFreelancer();
}

async function requireDemoFreelancer() {
  const jar = await cookies();
  const email = jar.get(DEMO_SESSION_COOKIE)?.value;
  if (!email) {
    throw new AuthError("Demo login required", 401);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError("Unknown demo user", 401);
  }
  return user;
}

async function requireSupabaseFreelancer() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    throw new AuthError("Authentication required", 401);
  }

  const email = data.user.email.toLowerCase();
  const authSubject = data.user.id;

  // Supabase user id is stable across email changes; match on it first.
  const bySubject = await prisma.user.findUnique({ where: { authSubject } });
  if (bySubject) {
    return bySubject.email === email
      ? bySubject
      : prisma.user.update({ where: { id: bySubject.id }, data: { email } });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { authSubject },
    create: {
      email,
      authSubject,
      name: data.user.user_metadata?.full_name ?? data.user.email,
    },
  });

  return user;
}

export async function getOptionalFreelancer() {
  try {
    return await requireFreelancer();
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
