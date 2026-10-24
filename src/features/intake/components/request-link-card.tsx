"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RequestLinkCard({
  projectId,
  initialToken,
  appUrl,
}: {
  projectId: string;
  initialToken: string | null;
  appUrl: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const url = token ? `${appUrl}/request/${token}` : null;

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/intake-link`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Could not create link");
      else setToken(data.token);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed. Select the link and copy it manually.");
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-normal">
        Client request link
      </h2>
      <p className="text-xs tracking-body text-muted-foreground">
        Your client sends requests here instead of email or chat. AI checks
        each one against the agreement and drafts your reply.
      </p>
      {url ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="Client request link"
            className="min-w-0 flex-1 truncate rounded-md border bg-transparent px-2 py-1.5 text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={create}>
          {pending ? "Creating…" : "Create request link"}
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
