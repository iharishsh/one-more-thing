"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BusyHint, BusyOverlay } from "@/components/busy-state";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RequestInput({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clientMessage: message,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to analyze request");
        return;
      }
      router.push(
        `/workspace/projects/${projectId}/changes/${data.change.id}`,
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-busy={pending}>
      <BusyOverlay
        active={pending}
        title="Analyzing request…"
        detail="AI is comparing this against the agreement. This can take a few seconds on the hosted server."
      />
      <div className="space-y-2">
        <Label htmlFor="clientMessage">Client message</Label>
        <Textarea
          id="clientMessage"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Paste what they sent you…"
          disabled={pending}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <BusyHint
        active={pending}
        title="Analyzing…"
        detail="Please wait — you’ll move to the review screen when it’s ready."
      />
      <Button type="submit" variant="brand" disabled={pending || !message.trim()}>
        {pending ? (
          <>
            <Spinner />
            Analyzing…
          </>
        ) : (
          "Analyze request"
        )}
      </Button>
    </form>
  );
}
