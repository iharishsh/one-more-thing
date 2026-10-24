"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { PayoutRow } from "@/features/billing/payouts.service";

const LABEL: Record<string, string> = {
  PROPOSED: "Needs your approval",
  EXECUTED: "Sent",
  REJECTED: "Skipped",
  FAILED: "Failed",
};
const TONE = {
  PROPOSED: "warning",
  EXECUTED: "paid",
  REJECTED: "muted",
  FAILED: "clarify",
} as const;

export function PayoutsPanel({
  proposalId,
  rows,
}: {
  proposalId: string;
  rows: PayoutRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(id: string, decision: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/billing/actions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Payout failed");
      router.refresh();
    });
  }

  function retry() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/billing/payouts/${proposalId}/retry`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Could not retry");
      router.refresh();
    });
  }

  const canRetry =
    rows.some((r) => r.status === "FAILED") &&
    !rows.some((r) => r.status === "PROPOSED");

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-heading">
          Subcontractor payouts
        </h2>
        <p className="max-w-prose text-sm tracking-body text-muted-foreground">
          The client paid, so AI drafted each subcontractor&apos;s agreed
          share. Nothing is sent until you approve.
        </p>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusBadge tone={TONE[row.status as keyof typeof TONE] ?? "muted"}>
                {LABEL[row.status] ?? row.status}
              </StatusBadge>
              <span className="text-sm font-medium">
                {row.value} {row.currency} to {row.subcontractorName}
              </span>
              {row.paypalStatus ? (
                <span className="text-xs text-muted-foreground">
                  PayPal: {row.paypalStatus.toLowerCase()}
                </span>
              ) : null}
            </div>
            <p className="text-sm tracking-body">{row.rationale}</p>
            <p className="text-xs text-muted-foreground">To {row.receiver}</p>
            {row.error ? (
              <p className="text-xs text-destructive">{row.error}</p>
            ) : null}
            {row.status === "PROPOSED" ? (
              <div className="mt-3 flex gap-2">
                <Button disabled={pending} onClick={() => decide(row.id, "approve")}>
                  Approve payout
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => decide(row.id, "reject")}
                >
                  Skip
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canRetry ? (
        <Button variant="outline" disabled={pending} onClick={retry}>
          Try again
        </Button>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
