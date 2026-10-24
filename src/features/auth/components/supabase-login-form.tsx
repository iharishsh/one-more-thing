"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyHint } from "@/components/busy-state";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  playAuthToWorkspaceTransition,
  setAuthChromeBusy,
  workspaceHref,
} from "@/lib/auth-exit";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function SupabaseLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    setAuthChromeBusy("login");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) throw signError;
      const href = workspaceHref(next);
      await playAuthToWorkspaceTransition(href);
      router.push(href);
      router.refresh();
    } catch (err) {
      setAuthChromeBusy(null);
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setPending(false);
    }
  }

  async function onDemo() {
    setError(null);
    setPending(true);
    setAuthChromeBusy("login");
    try {
      const res = await fetch("/api/auth/demo-account", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not open the demo");
      const href = workspaceHref(next);
      await playAuthToWorkspaceTransition(href);
      router.push(href);
      router.refresh();
    } catch (err) {
      setAuthChromeBusy(null);
      setError(err instanceof Error ? err.message : "Could not open the demo");
      setPending(false);
    }
  }

  const signupHref =
    next && next.startsWith("/")
      ? `/signup?next=${encodeURIComponent(next)}`
      : "/signup";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <BusyHint
        active={pending}
        title="Signing in…"
        detail="Checking your account, then opening the workspace."
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Spinner />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onDemo}
          className="w-full"
        >
          Explore the demo workspace
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          A shared sample account with projects already set up. Sandbox
          only, no real money.
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={signupHref}
          className="font-medium text-[color:var(--brand)] underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
