import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/server/db";
import { getEnv, isDemoAuthMode } from "@/server/env";
import { jsonError, jsonOk } from "@/server/http";
import { createSupabaseServerClient } from "@/server/supabase/server";

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
    const adminKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!email || !password || !adminKey || !env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error("The demo workspace is not available right now");
    }

    const supabase = await createSupabaseServerClient();
    const first = await supabase.auth.signInWithPassword({ email, password });
    if (!first.error) return jsonOk({ ok: true });

    // Sign-in failed: a visitor may have changed the shared account's password
    // or email. Restore it. (Only on failure: setting a password signs out
    // everyone else using the demo.)
    const demo = await prisma.user.findUnique({ where: { email } });
    if (!demo?.authSubject) {
      throw new Error("The demo workspace is not available right now");
    }
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, adminKey, {
      auth: { persistSession: false },
    });
    const { error: healError } = await admin.auth.admin.updateUserById(
      demo.authSubject,
      { email, password, email_confirm: true },
    );
    if (healError) throw new Error("The demo workspace is not available right now");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Could not open the demo workspace");
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
