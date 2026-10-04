"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ChangeActions({
  changeId,
  projectId,
  canDelete,
  canRevoke,
  locked = false,
  redirectToProject = false,
}: {
  changeId: string;
  projectId: string;
  canDelete: boolean;
  canRevoke: boolean;
  locked?: boolean;
  redirectToProject?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (locked) {
    return (
      <p className="max-w-[14rem] text-right text-xs tracking-body text-muted-foreground">
        Paid records are locked — view only
      </p>
    );
  }

  if (!canDelete && !canRevoke) {
    return null;
  }

  function afterSuccess() {
    if (redirectToProject) {
      router.push(`/workspace/projects/${projectId}`);
    }
    router.refresh();
  }

  function onDelete() {
    if (!window.confirm("Delete this unpublished analysis?")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/changes/${changeId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete");
        return;
      }
      afterSuccess();
    });
  }

  function onRevoke() {
    if (
      !window.confirm(
        "Withdraw the client link? They will no longer be able to accept or pay. Recorded acceptance is kept.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/changes/${changeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not revoke");
        return;
      }
      afterSuccess();
    });
  }

  return (
    <div className="space-y-1">
      {canDelete ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={pending}
        >
          {pending ? "Working…" : "Delete"}
        </Button>
      ) : null}
      {canRevoke ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRevoke}
          disabled={pending}
        >
          {pending ? "Working…" : "Withdraw link"}
        </Button>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
