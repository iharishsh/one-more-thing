import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/server/auth";
import { isDemoAuthMode } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  if (isDemoAuthMode()) {
    res.cookies.set(DEMO_SESSION_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return res;
}
