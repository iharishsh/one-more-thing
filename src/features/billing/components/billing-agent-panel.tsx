"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Action = {
  id: string;
  tool: string;
  argsJson: Record<string, unknown>;
  rationale: string;
  source: string;
  status: "PROPOSED" | "EXECUTED" | "REJECTED" | "FAILED";
  paypalInvoiceId: string | null;
  error: string | null;
  createdAt: string;
};

export type BillingPanelView = {
  available: boolean;
  unavailableReason: string | null;
  clientEmail: string | null;
  invoiceId: string | null;
  invoiceStatus: string | null;
  actions: Action[];
};

const TOOL_LABEL: Record<string, string> = {
  create_invoice: "Draft PayPal invoice",
  send_invoice: "Email invoice to client",
  send_invoice_reminder: "Send payment reminder",
};

const HISTORY_LABEL = {
  PROPOSED: "Waiting",
  EXECUTED: "Done",
  REJECTED: "Skipped",
  FAILED: "Failed",
} as const;

const STATUS_TONE = {
  PROPOSED: "warning",
  EXECUTED: "paid",
  REJECTED: "muted",
  FAILED: "clarify",
} as const;

/** What the freelancer is approving, in plain words. */
function describeArgs(action: Action) {
  const args = action.argsJson;
  if (action.tool === "create_invoice") {
    const items = (args.items as Array<{
      name: string;
      quantity: string;
      unit_amount: { value: string };
    }>) ?? [];
    const to = (
      args.primary_recipients as Array<{
        billing_info?: { email_address?: string };
      }>
    )?.[0]?.billing_info?.email_address;
    return [
      `To ${to ?? "?"}`,
      ...items.map(
        (i) => `${i.quantity} × ${i.name}: ${i.unit_amount.value} ${String(args.currency_code)}`,
      ),
      args.note ? `Note: ${String(args.note)}` : null,
    ].filter(Boolean) as string[];
  }
  return [
    `PayPal invoice ${String(args.invoice_id)}`,
    args.subject ? `Subject: ${String(args.subject)}` : null,
    args.note ? `Note: ${String(args.note)}` : null,
  ].filter(Boolean) as string[];
}

export function BillingAgentPanel({
  proposalId,
  initial,
}: {
  proposalId: string;
  initial: BillingPanelView | null;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<BillingPanelView | null>(initial);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch(`/api/billing/${proposalId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not load payment follow-up");
      return;
    }
    setPanel(data);
  }

  function plan() {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await fetch(`/api/billing/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEmail: email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Agent could not plan");
      else if (data.status === "idle") setNote(data.message);
      await load();
    });
  }

  function decide(actionId: string, decision: "approve" | "reject") {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await fetch(`/api/billing/actions/${actionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Action failed");
      await load();
      router.refresh();
    });
  }

  if (!panel) {
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <p className="text-sm text-muted-foreground">Payment follow-up is unavailable.</p>
    );
  }

  const proposed = panel.actions.find((a) => a.status === "PROPOSED");
  const history = panel.actions.filter((a) => a.status !== "PROPOSED");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-heading">
            Payment follow-up
          </h2>
          <p className="max-w-prose text-sm tracking-body text-muted-foreground">
            The client accepted but hasn&apos;t paid yet. AI can send them a
            PayPal invoice for the agreed amount and follow up. You approve
            each step before anything is sent.
          </p>
        </div>
        {panel.invoiceStatus ? (
          <StatusBadge
            tone={panel.invoiceStatus === "PAID" ? "paid" : "default"}
          >
            Invoice {panel.invoiceStatus.toLowerCase().replace(/_/g, " ")}
          </StatusBadge>
        ) : null}
      </div>

      {!panel.available ? (
        <p className="text-sm text-muted-foreground">
          {panel.unavailableReason}
        </p>
      ) : proposed ? (
        <div className="rounded-lg border border-[color:var(--brand)]/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <StatusBadge tone="warning">Needs your approval</StatusBadge>
            <span className="text-sm font-medium">
              {TOOL_LABEL[proposed.tool] ?? proposed.tool}
            </span>
          </div>
          <p className="mb-3 text-sm tracking-body">{proposed.rationale}</p>
          <ul className="mb-4 space-y-1 text-sm text-muted-foreground">
            {describeArgs(proposed).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mb-3 text-xs text-muted-foreground">
            Amount and recipient checked against the accepted proposal.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() => decide(proposed.id, "approve")}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => decide(proposed.id, "reject")}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {!panel.clientEmail ? (
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="billing-client-email">Client email</Label>
              <Input
                id="billing-client-email"
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          ) : null}
          <Button disabled={pending} onClick={plan}>
            {pending
              ? "Preparing…"
              : history.length
                ? "Check what’s next"
                : "Prepare PayPal invoice"}
          </Button>
        </div>
      )}

      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {history.length ? (
        <ol className="space-y-2 border-t pt-3">
          {history.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge tone={STATUS_TONE[a.status]}>
                {HISTORY_LABEL[a.status]}
              </StatusBadge>
              <span>{TOOL_LABEL[a.tool] ?? a.tool}</span>
              {a.paypalInvoiceId ? (
                <code className="text-xs text-muted-foreground">
                  {a.paypalInvoiceId}
                </code>
              ) : null}
              {a.error ? (
                <span className="text-xs text-destructive">{a.error}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
