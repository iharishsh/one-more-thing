import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/server/db";
import { getEnv, isDemoAuthMode } from "@/server/env";
import { jsonError, jsonOk } from "@/server/http";
import { createSupabaseServerClient } from "@/server/supabase/server";

const UNAVAILABLE = "The demo workspace is not available right now";

/** Signs the visitor into the shared judge demo workspace. Credentials stay on
 * the server; the browser only receives the normal session cookie. */
export async function POST() {
  try {
    const env = getEnv();
    if (isDemoAuthMode()) {
      throw new Error("Use the Freelancer A / B buttons in demo auth mode");
    }
    const email = process.env.DEMO_ACCOUNT_EMAIL?.trim().toLowerCase();
    const password = process.env.DEMO_ACCOUNT_PASSWORD;
    if (!email || !password || !env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error(
        "[demo-account] missing env:",
        [
          !email && "DEMO_ACCOUNT_EMAIL",
          !password && "DEMO_ACCOUNT_PASSWORD",
          !env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
        ].filter(Boolean),
      );
      throw new Error(UNAVAILABLE);
    }

    const supabase = await createSupabaseServerClient();
    const first = await supabase.auth.signInWithPassword({ email, password });
    if (!first.error) return jsonOk({ ok: true });

    // Sign-in failed: a visitor may have changed the shared account's password
    // or email. Restore it. (Only on failure: setting a password signs out
    // everyone else using the demo.) Needs the Supabase admin key.
    const adminKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    const demo = await prisma.user.findUnique({ where: { email } });
    if (!adminKey || !demo?.authSubject) {
      console.error("[demo-account] sign-in failed and cannot self-heal:", {
        signInError: first.error.message,
        hasAdminKey: Boolean(adminKey),
        demoUserFound: Boolean(demo?.authSubject),
      });
      throw new Error(UNAVAILABLE);
    }
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, adminKey, {
      auth: { persistSession: false },
    });
    const { error: healError } = await admin.auth.admin.updateUserById(
      demo.authSubject,
      { email, password, email_confirm: true },
    );
    if (healError) {
      console.error("[demo-account] self-heal failed:", healError.message);
      throw new Error(UNAVAILABLE);
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Could not open the demo workspace");
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
