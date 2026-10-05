"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";

type AgentState = {
  thread: {
    inviteUrl: string;
    revokedAt: string | null;
    messages: Array<{
      id: string;
      kind: string;
      visibility: string;
      body: string;
      createdAt: string;
    }>;
  } | null;
  run: {
    id: string;
    status: string;
    draftStale: boolean;
    needsReviewReason: string | null;
    pendingClarification: {
      question: string;
      relatedClaims: string[];
    } | null;
    analysis: {
      primaryOutcome: string;
      included: Array<{ claim: string }>;
      additional: Array<{ claim: string }>;
      unclear: Array<{ claim: string }>;
    } | null;
  } | null;
};

export function PrepareChangePanel({ changeId }: { changeId: string }) {
  const router = useRouter();
  const [state, setState] = useState<AgentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedQuestion, setEditedQuestion] = useState("");
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const res = await fetch(`/api/changes/${changeId}/agent`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not load agent state");
      return;
    }
    setState(data);
    if (data.run?.pendingClarification?.question) {
      setEditedQuestion(data.run.pendingClarification.question);
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll by changeId
  }, [changeId]);

  function onPrepare() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/changes/${changeId}/prepare`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not start");
        return;
      }
      await refresh();
      router.refresh();
    });
  }

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/changes/${changeId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_clarification",
          editedQuestion,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not approve");
        return;
      }
      await refresh();
      router.refresh();
    });
  }

  function onRevoke() {
    if (!window.confirm("Revoke the client thread invite?")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/changes/${changeId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_invite" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not revoke");
        return;
      }
      await refresh();
    });
  }

  const run = state?.run;
  const trail =
    state?.thread?.messages.filter(
      (m) => m.visibility === "PRIVATE" || m.kind === "ACTIVITY",
    ) ?? [];

  return (
    <section className="surface-card space-y-4 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading text-xl">Prepare this change</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Agent clarifies missing details, then drafts findings. Manual review
            and publish stay available.
          </p>
        </div>
        <Button type="button" onClick={onPrepare} disabled={pending}>
          {pending ? "Working…" : "Prepare this change"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {run ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(run.status)}>
            {statusLabel(run.status)}
          </StatusBadge>
          {run.draftStale ? (
            <StatusBadge tone="warning">Stale vs agreement</StatusBadge>
          ) : null}
        </div>
      ) : null}

      {run?.needsReviewReason ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Needs your review: {run.needsReviewReason}
        </p>
      ) : null}

      {run?.status === "WAITING_APPROVAL" && run.pendingClarification ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Approve clarification to client</p>
          <Textarea
            value={editedQuestion}
            onChange={(e) => setEditedQuestion(e.target.value)}
            rows={3}
          />
          <Button type="button" onClick={onApprove} disabled={pending}>
            Share with client
          </Button>
        </div>
      ) : null}

      {run?.status === "WAITING_CLIENT" && state?.thread?.inviteUrl ? (
        <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
          <p className="font-medium">Waiting for client answer</p>
          <p className="break-all text-muted-foreground">{state.thread.inviteUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard.writeText(state.thread!.inviteUrl)}
            >
              Copy invite link
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRevoke}
              disabled={pending}
            >
              Revoke invite
            </Button>
          </div>
        </div>
      ) : null}

      {run?.analysis ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">
            Draft items ({run.analysis.primaryOutcome})
          </p>
          <ul className="space-y-1 text-muted-foreground">
            {run.analysis.included.map((i) => (
              <li key={`i-${i.claim}`}>Included — {i.claim}</li>
            ))}
            {run.analysis.additional.map((i) => (
              <li key={`a-${i.claim}`}>
                Additional — {i.claim} (price unset)
              </li>
            ))}
            {run.analysis.unclear.map((i) => (
              <li key={`u-${i.claim}`}>Unclear — {i.claim}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {trail.length > 0 ? (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Activity
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {trail.slice(-8).map((m) => (
              <li key={m.id}>• {m.body}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "QUEUED":
    case "RUNNING":
      return "Working";
    case "WAITING_APPROVAL":
      return "Approve clarification";
    case "WAITING_CLIENT":
      return "Waiting on client";
    case "DRAFT_READY":
      return "Draft ready";
    case "NEEDS_REVIEW":
      return "Needs review";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function statusTone(status: string): "default" | "warning" | "paid" | "muted" | "clarify" | "included" | "additional" {
  if (status === "DRAFT_READY") return "included";
  if (status === "NEEDS_REVIEW" || status === "WAITING_APPROVAL") return "warning";
  if (status === "WAITING_CLIENT") return "clarify";
  if (status === "CANCELLED") return "muted";
  return "default";
}
