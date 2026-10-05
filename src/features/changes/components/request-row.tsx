"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUsd } from "@/lib/money";

export function RequestRow({
  changeId,
  projectId,
  title,
  statusLabel,
  statusTone,
  href,
  amountCents,
  canDelete,
  canRevoke,
  updatedLabel,
}: {
  changeId: string;
  projectId: string;
  title: string;
  statusLabel: string;
  statusTone: "default" | "warning" | "paid" | "muted" | "clarify" | "included" | "additional";
  href: string;
  amountCents?: number | null;
  canDelete: boolean;
  canRevoke: boolean;
  updatedLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm("Delete this unpublished request?")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/changes/${changeId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete");
        return;
      }
      router.refresh();
    });
  }

  function onRevoke() {
    if (
      !window.confirm(
        "Withdraw the client link? They will no longer be able to accept or pay.",
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
        setError(data.error ?? "Could not withdraw");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 border-b border-border py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <Link
          href={href}
          className="block truncate text-sm font-medium text-foreground no-underline hover:text-[color:var(--brand)]"
        >
          {title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          {amountCents != null && amountCents > 0 ? (
            <span className="text-xs text-muted-foreground">
              {formatUsd(amountCents)}
            </span>
          ) : null}
          {updatedLabel ? (
            <span className="text-xs text-muted-foreground">{updatedLabel}</span>
          ) : null}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      {(canDelete || canRevoke) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="More actions"
            >
              ···
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem asChild>
              <Link href={href}>Open</Link>
            </DropdownMenuItem>
            {canRevoke ? (
              <DropdownMenuItem disabled={pending} onSelect={onRevoke}>
                Withdraw link
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onSelect={onDelete}
              >
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <span className="sr-only">{projectId}</span>
    </li>
  );
}
