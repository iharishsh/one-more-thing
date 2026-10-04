import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoLoginForm } from "@/features/auth/components/demo-login-form";
import { SupabaseSignupForm } from "@/features/auth/components/supabase-signup-form";
import { getOptionalFreelancer } from "@/server/auth";
import { getEnv } from "@/server/env";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const env = getEnv();
  const existing = await getOptionalFreelancer();
  if (existing) {
    redirect(next && next.startsWith("/") ? next : "/workspace");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Sign up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {env.AUTH_MODE === "demo"
            ? "Demo mode uses pre-seeded accounts — pick one below (same as log in)."
            : "Create a freelancer account. Your projects stay private to you."}
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
      ) : null}
      {env.AUTH_MODE === "demo" ? (
        <>
          <DemoLoginForm next={next} />
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-[color:var(--brand)] underline-offset-4 hover:underline"
            >
              Back to log in
            </Link>
          </p>
        </>
      ) : (
        <SupabaseSignupForm next={next} />
      )}
    </div>
  );
}
