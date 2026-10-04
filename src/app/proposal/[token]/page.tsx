import { notFound } from "next/navigation";
import { PaymentStatus } from "@/generated/prisma/client";
import { AppHeader } from "@/components/app-header";
import { PageMain, PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { ClientAcceptance } from "@/features/proposals/components/client-acceptance";
import { ProposalPreview } from "@/features/proposals/components/proposal-preview";
import { PaypalCheckout } from "@/features/payments/components/paypal-checkout";
import { PaymentStatusView } from "@/features/payments/components/payment-status";
import { canPay } from "@/features/proposals/proposal-state";
import {
  findProposalByToken,
  getProposalLinkStatus,
} from "@/server/access";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getProposalLinkStatus(token);

  if (link.state === "missing") {
    notFound();
  }

  // Invalidated links: minimal status only — do not expose agreement terms.
  if (link.state === "revoked" || link.state === "expired") {
    return (
      <PageShell className="bg-white">
        <AppHeader variant="client" />
        <PageMain className="max-w-lg space-y-4">
          <p className="eyebrow">Client proposal</p>
          <div className="surface-card space-y-3 p-6">
            <h1 className="text-heading">
              {link.state === "revoked" ? "Link withdrawn" : "Link expired"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {link.state === "revoked"
                ? "This proposal link is no longer valid. Ask the freelancer for a new link if you still need to review terms."
                : "This proposal link has expired. Ask the freelancer to send a fresh link."}
            </p>
            {link.version != null ? (
              <p className="text-xs text-muted-foreground">
                Reference: proposal v{link.version}
              </p>
            ) : null}
          </div>
        </PageMain>
      </PageShell>
    );
  }

  const proposal = await findProposalByToken(token);
  if (!proposal) notFound();

  const accepted = Boolean(proposal.acceptance);
  const paid = proposal.payments.some(
    (p) => p.status === PaymentStatus.CAPTURED,
  );
  const showCheckout =
    canPay(proposal.status, accepted, proposal.priceCents) && !paid;

  return (
    <PageShell className="bg-white">
      <AppHeader variant="client" />
      <PageMain className="max-w-2xl space-y-6">
        {paid ? (
          <div className="rounded-[var(--radius-xl)] bg-[#e5f6e8] px-4 py-3">
            <p className="text-lg font-extrabold tracking-heading text-[#0f5c2e] font-[family-name:var(--font-pro)]">
              Payment received
            </p>
            <p className="mt-1 text-sm text-[#0f5c2e]/90">
              The agreed work is now part of the project checklist.
            </p>
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">Client proposal</p>
            {paid ? <StatusBadge tone="paid">Paid</StatusBadge> : null}
            {accepted && !paid ? (
              <StatusBadge tone="warning">Accepted</StatusBadge>
            ) : null}
            {proposal.status === "DECLINED" ? (
              <StatusBadge tone="warning">Declined</StatusBadge>
            ) : null}
            {proposal.status === "CHANGES_REQUESTED" ? (
              <StatusBadge tone="warning">Changes requested</StatusBadge>
            ) : null}
          </div>
          <div className="surface-card p-5 md:p-6">
            <ProposalPreview proposal={proposal} />
          </div>
        </section>

        {!paid && proposal.status === "PUBLISHED" ? (
          <section className="surface-card space-y-3 p-5">
            <h2 className="text-subhead">Your response</h2>
            <ClientAcceptance token={token} alreadyAccepted={accepted} />
          </section>
        ) : null}

        {!paid && proposal.status === "DECLINED" ? (
          <p className="text-sm text-muted-foreground">
            You declined this proposal. The freelancer may send a revised link.
          </p>
        ) : null}
        {!paid && proposal.status === "CHANGES_REQUESTED" ? (
          <p className="text-sm text-muted-foreground">
            Change request sent. Wait for a revised proposal link.
          </p>
        ) : null}

        <section className="surface-card space-y-3 p-5">
          <h2 className="text-subhead">Payment</h2>
          {paid ? (
            <p className="text-sm font-medium text-[#0f5c2e]">
              Payment complete. Agreed checklist changes are applied.
            </p>
          ) : !accepted ? (
            <p className="text-sm text-muted-foreground">
              Accept the proposal before checkout.
            </p>
          ) : proposal.priceCents === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payment required. Delivery updates apply on acceptance.
            </p>
          ) : showCheckout ? (
            <>
              <p className="text-xs text-muted-foreground">
                Demo / sandbox — no real money
              </p>
              <PaypalCheckout
                token={token}
                priceCents={proposal.priceCents}
                currency={proposal.currency}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Checkout is not available for this proposal state.
            </p>
          )}
          <PaymentStatusView payments={proposal.payments} />
        </section>

        <section className="space-y-2">
          <h2 className="text-subhead">Project checklist</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {proposal.changeRequest.project.deliverables.map((d) => (
              <li key={d.id}>{d.title}</li>
            ))}
          </ul>
        </section>
      </PageMain>
    </PageShell>
  );
}
