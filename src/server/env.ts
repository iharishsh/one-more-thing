import "server-only";

import { z } from "zod";

/** Treat empty strings as unset (common in .env files). */
const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional(),
);
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  /** demo = explicit cookie/session demo users; supabase = real Supabase Auth */
  AUTH_MODE: z.enum(["demo", "supabase"]).default("demo"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  /** New Supabase dashboard name (preferred) */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SECRET_KEY: optionalString,
  /** Legacy names still accepted as fallbacks */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  PAYPAL_CLIENT_ID: optionalString,
  PAYPAL_CLIENT_SECRET: optionalString,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: optionalString,
  PAYPAL_WEBHOOK_ID: optionalString,
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  /** Minutes after a client accepts before AI drafts payment follow-up (0 = immediately). */
  BILLING_FOLLOWUP_AFTER_MINUTES: optionalString,
  /** Shared judge demo account (see `pnpm demo:reset`). Server-only. */
  DEMO_ACCOUNT_EMAIL: optionalString,
  DEMO_ACCOUNT_PASSWORD: optionalString,
  AI_PROVIDER: z.enum(["manual", "ollama", "hosted"]).default("manual"),
  OLLAMA_BASE_URL: optionalUrl,
  OLLAMA_MODEL: optionalString,
  /** Failover order for AI_PROVIDER=hosted (comma-separated): groq,openrouter,openai,custom */
  HOSTED_AI_CHAIN: optionalString,
  GROQ_API_KEY: optionalString,
  GROQ_BASE_URL: optionalUrl,
  GROQ_MODEL: optionalString,
  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_BASE_URL: optionalUrl,
  OPENROUTER_MODEL: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_MODEL: optionalString,
  HOSTED_AI_API_KEY: optionalString,
  HOSTED_AI_BASE_URL: optionalUrl,
  HOSTED_AI_MODEL: optionalString,
  CHANNEL3_API_KEY: optionalString,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_AUTH_MODE: z.enum(["demo", "supabase"]).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = envSchema.parse(process.env);
    if (cached.AUTH_MODE === "supabase") {
      const publishable =
        cached.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        cached.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!cached.NEXT_PUBLIC_SUPABASE_URL || !publishable) {
        throw new Error(
          "AUTH_MODE=supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy ANON_KEY)",
        );
      }
    }
  }
  return cached;
}

export function isDemoAuthMode() {
  return getEnv().AUTH_MODE === "demo";
}
