"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatUsd } from "@/lib/money";

export type LiveProposal = {
  id: string;
  version: number;
  status: string;
  priceCents: number;
  clientToken: string;
  summary: string;
  deliveryNote?: string | null;
  deliveryImpact?: string | null;
  statusLabel: string;
  statusTone: "default" | "warning" | "paid" | "muted" | "clarify" | "included" | "additional";
};

export function PublishedProposalPanel({
  changeId,
  proposal,
  appUrl,
  canRevoke,
  onCreateRevision,
}: {
  changeId: string;
  projectId?: string;
  proposal: LiveProposal;
  appUrl: string;
  canRevoke: boolean;
  onCreateRevision: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const clientUrl = `${appUrl.replace(/\/$/, "")}/proposal/${proposal.clientToken}`;
  const delivery =
    proposal.deliveryImpact?.trim() ||
    proposal.deliveryNote?.trim() ||
    "Delivery unset";

  function copyLink() {
    void navigator.clipboard.writeText(clientUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function withdraw() {
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
    <section className="space-y-4 rounded-2xl bg-muted/40 p-4 ring-1 ring-border/80 sm:p-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Published · v{proposal.version}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline">
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem onSelect={onCreateRevision}>
                Create revision
              </DropdownMenuItem>
              {canRevoke ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onSelect={withdraw}
                >
                  Withdraw link
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h2 className="text-lg font-semibold tracking-normal">
          {proposal.summary}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge tone={proposal.statusTone}>
            {proposal.statusLabel}
          </StatusBadge>
          {proposal.priceCents > 0 ? (
            <span className="text-money font-semibold">
              {formatUsd(proposal.priceCents)}
            </span>
          ) : (
            <span className="text-muted-foreground">No extra charge</span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Delivery: {delivery}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="brand" onClick={copyLink}>
          {copied ? "Copied" : "Copy client link"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={clientUrl} target="_blank" rel="noreferrer">
            Preview proposal
          </a>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        This version is live. Open a revision only if you need new terms.
      </p>
    </section>
  );
}
