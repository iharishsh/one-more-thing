"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ClientRequestForm({ token }: { token: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: String(formData.get("clientName") || "").trim() || undefined,
          message: String(formData.get("message") || "").trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send your request");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-2">
        <p className="text-base font-semibold">Request sent</p>
        <p className="text-sm text-muted-foreground">
          Thanks! Your freelancer has it and will reply soon. You can send
          another request any time with this same link.
        </p>
        <Button variant="outline" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="clientName">Your name (optional)</Label>
        <Input id="clientName" name="clientName" placeholder="Alex Client" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">What would you like?</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={5}
          rows={6}
          placeholder="e.g. Could we add a dark mode? Our evening customers keep asking."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        AI reads your message to help your freelancer check it against your
        agreement. Please don&apos;t include passwords or card details.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
