import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/server/env";
import { getSupabasePublishableKey } from "@/server/supabase/keys";

export async function createSupabaseServerClient() {
  const env = getEnv();
  const publishable = getSupabasePublishableKey();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !publishable) {
    throw new Error("Supabase is not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, publishable, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}
