"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = {
  id: string;
  kind: string;
  body: string;
  createdAt: string | Date;
};

export function ClientThreadPanel({
  token,
  initialMessages,
  waitingForAnswer,
}: {
  token: string;
  initialMessages: Message[];
  waitingForAnswer: boolean;
}) {
  const router = useRouter();
  const answerId = useId();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setError(null);
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ans-${Date.now()}`;

    startTransition(async () => {
      const res = await fetch(`/api/thread/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, idempotencyKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send answer");
        return;
      }
      setSubmitted(true);
      setAnswer("");
      router.refresh();
    });
  }

  return (
    <div className="surface-card space-y-4 p-5 md:p-6">
      <ul className="space-y-3">
        {initialMessages.map((message) => (
          <li key={message.id} className="rounded-xl bg-muted/40 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labelForKind(message.kind)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {message.body}
            </p>
          </li>
        ))}
      </ul>

      {waitingForAnswer && !submitted ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <label htmlFor={answerId} className="text-sm font-medium">
            Your answer
          </label>
          <Textarea
            id={answerId}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            rows={4}
            placeholder="Share the missing details…"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send answer"}
          </Button>
        </form>
      ) : null}

      {submitted || (!waitingForAnswer && initialMessages.length > 0) ? (
        <p className="text-sm text-muted-foreground">
          {submitted
            ? "Answer received. Your freelancer’s assistant will continue preparing the change."
            : "No clarification is waiting right now."}
        </p>
      ) : null}
    </div>
  );
}

function labelForKind(kind: string) {
  if (kind === "CLIENT_REQUEST") return "Your request";
  if (kind === "CLARIFICATION_QUESTION") return "Question";
  if (kind === "CLIENT_ANSWER") return "Your answer";
  return "Update";
}
