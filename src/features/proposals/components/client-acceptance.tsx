"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BusyHint } from "@/components/busy-state";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ClientAcceptance({
  token,
  alreadyAccepted,
}: {
  token: string;
  alreadyAccepted: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [mode, setMode] = useState<"accept" | "changes" | "decline">("accept");
  const [pending, startTransition] = useTransition();

  if (alreadyAccepted) {
    return (
      <p className="text-sm text-muted-foreground">
        You accepted these terms. Continue to payment if a fee applies.
      </p>
    );
  }

  function onAccept(formData: FormData) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await fetch(`/api/proposals/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formData.get("clientName") || undefined,
          acknowledgment:
            formData.get("acknowledgment") ||
            "I accept these exact proposal terms.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not accept proposal");
        return;
      }
      router.refresh();
    });
  }

  function onRespond(action: "request_changes" | "decline", formData: FormData) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await fetch(`/api/proposals/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          clientName: formData.get("clientName") || undefined,
          message: String(formData.get("message") || "").trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send response");
        return;
      }
      setNote(
        action === "decline"
          ? "Decline recorded. The freelancer will see it in project activity."
          : "Change request sent. The freelancer will see it in project activity.",
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "accept" ? "default" : "outline"}
          onClick={() => setMode("accept")}
        >
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "changes" ? "default" : "outline"}
          onClick={() => setMode("changes")}
        >
          Ask for a change
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "decline" ? "default" : "outline"}
          onClick={() => setMode("decline")}
        >
          Decline
        </Button>
      </div>

      {mode === "accept" ? (
        <form action={onAccept} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Your name (optional)</Label>
            <Input id="clientName" name="clientName" placeholder="Alex Client" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acknowledgment">Acknowledgment</Label>
            <Input
              id="acknowledgment"
              name="acknowledgment"
              defaultValue="I accept these exact proposal terms."
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <BusyHint
            active={pending}
            title="Accepting…"
            detail="Recording your acceptance."
          />
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner />
                Accepting…
              </>
            ) : (
              "Accept and continue"
            )}
          </Button>
        </form>
      ) : null}

      {mode === "changes" ? (
        <form
          action={(fd) => onRespond("request_changes", fd)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="cn2">Your name (optional)</Label>
            <Input id="cn2" name="clientName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="msg2">What would you change?</Label>
            <Textarea id="msg2" name="message" rows={4} required />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {note ? (
            <p className="text-sm text-[color:var(--brand)]">{note}</p>
          ) : null}
          <BusyHint active={pending} title="Sending…" detail="Notifying the freelancer." />
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner />
                Sending…
              </>
            ) : (
              "Send change request"
            )}
          </Button>
        </form>
      ) : null}

      {mode === "decline" ? (
        <form action={(fd) => onRespond("decline", fd)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cn3">Your name (optional)</Label>
            <Input id="cn3" name="clientName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="msg3">Reason (optional but helpful)</Label>
            <Textarea
              id="msg3"
              name="message"
              rows={3}
              defaultValue="I’d rather not proceed with this proposal."
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {note ? (
            <p className="text-sm text-[color:var(--brand)]">{note}</p>
          ) : null}
          <BusyHint active={pending} title="Sending…" detail="Recording your response." />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? (
              <>
                <Spinner />
                Sending…
              </>
            ) : (
              "Decline proposal"
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
