"use client";

import Link from "next/link";
import { useState } from "react";
import { BusyHint } from "@/components/busy-state";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function SupabaseSignupForm({ next }: { next?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Enter your name.");
      return;
    }
    if (!trimmedEmail) {
      setError("Enter your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { data, error: signError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
          emailRedirectTo: `${origin}/login`,
        },
      });
      if (signError) throw signError;

      // Session present when email confirmation is disabled in Supabase.
      if (data.session) {
        // Keep pending true through the full navigation.
        window.location.href =
          next && next.startsWith("/") ? next : "/workspace";
        return;
      }

      setInfo(
        "Account created. Check your email to confirm, then log in. (For demos, you can disable “Confirm email” in Supabase Auth settings.)",
      );
      setPending(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
      setPending(false);
    }
  }

  const loginHref =
    next && next.startsWith("/")
      ? `/login?next=${encodeURIComponent(next)}`
      : "/login";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Freelancer"
        />
      </div>
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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 6 characters.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-[#0f5c2e]">{info}</p> : null}
      <BusyHint
        active={pending}
        title="Creating account…"
        detail="Setting up your freelancer profile."
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Spinner />
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="font-medium text-[color:var(--brand)] underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
