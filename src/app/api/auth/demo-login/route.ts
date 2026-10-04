import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEMO_FREELANCER_A,
  DEMO_FREELANCER_B,
  DEMO_SESSION_COOKIE,
} from "@/server/auth";
import { prisma } from "@/server/db";
import { getEnv, isDemoAuthMode } from "@/server/env";
import { jsonError, jsonOk } from "@/server/http";

const bodySchema = z.object({
  email: z.enum([DEMO_FREELANCER_A, DEMO_FREELANCER_B]),
});

export async function POST(request: Request) {
  try {
    getEnv();
    if (!isDemoAuthMode()) {
      return jsonError(new Error("Demo login is disabled when AUTH_MODE=supabase"), 400);
    }

    const body = bodySchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return jsonError(
        new Error("Demo user missing — run pnpm db:seed"),
        400,
      );
    }

    const res = jsonOk({ ok: true, email: user.email });
    res.cookies.set(DEMO_SESSION_COOKIE, user.email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
