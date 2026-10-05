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
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
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
          discussionNotes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to prepare decision");
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
        title="Preparing decision…"
        detail="Comparing this conversation with the agreement."
      />
      <div className="space-y-2">
        <Label htmlFor="clientMessage">Client request</Label>
        <Textarea
          id="clientMessage"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Paste what they sent you…"
          disabled={pending}
        />
      </div>
      <button
        type="button"
        className="text-sm font-medium text-[color:var(--brand)]"
        onClick={() => setShowNotes((v) => !v)}
      >
        {showNotes ? "Hide discussion notes" : "Add discussion notes"}
      </button>
      {showNotes ? (
        <div className="space-y-2">
          <Label htmlFor="discussionNotes">
            Discussion notes (your notes — not acceptance)
          </Label>
          <Textarea
            id="discussionNotes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you already clarified on a call or chat…"
            disabled={pending}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <BusyHint
        active={pending}
        title="Preparing…"
        detail="You’ll move to the review screen when it’s ready."
      />
      <Button type="submit" variant="brand" disabled={pending || !message.trim()}>
        {pending ? (
          <>
            <Spinner />
            Preparing…
          </>
        ) : (
          "Prepare decision"
        )}
      </Button>
    </form>
  );
}
