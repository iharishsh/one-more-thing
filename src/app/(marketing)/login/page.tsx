import { redirect } from "next/navigation";
import { DemoLoginForm } from "@/features/auth/components/demo-login-form";
import { SupabaseLoginForm } from "@/features/auth/components/supabase-login-form";
import { getOptionalFreelancer } from "@/server/auth";
import { getEnv } from "@/server/env";

export default async function LoginPage({
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
        <h1 className="text-heading">Log in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {env.AUTH_MODE === "demo"
            ? "Demo mode: pick a freelancer account. Isolation is enforced by owner checks — account B cannot access account A's projects."
            : "Sign in with the account you created via Sign up."}
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
      ) : null}
      {env.AUTH_MODE === "demo" ? (
        <DemoLoginForm next={next} />
      ) : (
        <SupabaseLoginForm next={next} />
      )}
    </div>
  );
}
