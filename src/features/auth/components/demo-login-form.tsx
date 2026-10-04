"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  playAuthToWorkspaceTransition,
  setAuthChromeBusy,
  workspaceHref,
} from "@/lib/auth-exit";
import { cn } from "@/lib/utils";

const ACCOUNTS = [
  {
    email: "freelancer@example.com",
    label: "Demo Freelancer A",
    hint: "Owns Landing page redesign + seeded work",
  },
  {
    email: "freelancer-b@example.com",
    label: "Demo Freelancer B",
    hint: "Separate workspace — must not see A’s projects",
  },
] as const;

export function DemoLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function loginAs(email: string) {
    setError(null);
    setPending(email);
    setAuthChromeBusy("login");
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      const href = workspaceHref(next);
      await playAuthToWorkspaceTransition(href);
      router.push(href);
      router.refresh();
    } catch (e) {
      setAuthChromeBusy(null);
      setError(e instanceof Error ? e.message : "Login failed");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {ACCOUNTS.map((account) => (
        <button
          key={account.email}
          type="button"
          disabled={pending !== null}
          onClick={() => loginAs(account.email)}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-auto w-full flex-col items-start gap-1 px-4 py-3 text-left whitespace-normal",
          )}
        >
          <span className="font-semibold">
            {pending === account.email ? "Signing in…" : account.label}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {account.email} — {account.hint}
          </span>
        </button>
      ))}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
