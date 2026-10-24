import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentStatus } from "@/generated/prisma/client";
import { AppHeader } from "@/components/app-header";
import {
  PageHeader,
  PageMain,
  PageShell,
} from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import {
  BillingAgentPanel,
  type BillingPanelView,
} from "@/features/billing/components/billing-agent-panel";
import { getBillingPanel } from "@/features/billing/billing-agent.service";
import { PayoutsPanel } from "@/features/billing/components/payouts-panel";
import { getPayoutRows } from "@/features/billing/payouts.service";
import { ChangeActions } from "@/features/changes/components/change-actions";
import { ReviewDecisionEditor } from "@/features/changes/components/review-decision-editor";
import type { LiveProposal } from "@/features/changes/components/published-proposal-panel";
import { analysisStatusLabel } from "@/features/changes/analysis-display";
import {
  canDeleteChangeRequest,
  canRevokeChangeRequest,
  getAnalysis,
  getChangeForOwner,
  hasCapturedPayment,
} from "@/features/changes/change.service";
import { cleanOpeningRequest } from "@/features/changes/opening-request";
import { isAgreementUnconfirmed } from "@/features/changes/provisional-agreement";
import { getAiAssistStatus } from "@/server/ai/assist-status";
import { requireFreelancer } from "@/server/auth";

function proposalStatusLabel(
  status: string,
  payments: Array<{ status: PaymentStatus }>,
): { label: string; tone: LiveProposal["statusTone"] } {
  if (payments.some((p) => p.status === PaymentStatus.CAPTURED)) {
    return { label: "Payment received", tone: "paid" };
  }
  if (status === "ACCEPTED")
    return { label: "Awaiting payment", tone: "warning" };
  if (status === "PUBLISHED")
    return { label: "Awaiting client", tone: "default" };
  if (status === "REVOKED") return { label: "Withdrawn", tone: "muted" };
  if (status === "SUPERSEDED") return { label: "Superseded", tone: "muted" };
  return { label: status, tone: "muted" };
}

export default async function ChangePage({
  params,
}: {
  params: Promise<{ projectId: string; changeId: string }>;
}) {
  const { projectId, changeId } = await params;
  const user = await requireFreelancer();

  let change;
  try {
    change = await getChangeForOwner(changeId, user.id);
  } catch {
    notFound();
  }
  if (change.projectId !== projectId) notFound();

  const analysis = getAnalysis(change);
  const locked = hasCapturedPayment(change);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const latest = change.proposals[0] ?? null;
  const liveStatus = latest
    ? proposalStatusLabel(latest.status, latest.payments)
    : null;

  const liveProposal: LiveProposal | null =
    latest &&
    !latest.revokedAt &&
    (latest.status === "PUBLISHED" || latest.status === "ACCEPTED") &&
    liveStatus
      ? {
          id: latest.id,
          version: latest.version,
          status: latest.status,
          priceCents: latest.priceCents,
          clientToken: latest.clientToken,
          summary: latest.summary,
          deliveryNote:
            typeof latest.termsJson === "object" &&
            latest.termsJson &&
            "deliveryNote" in latest.termsJson
              ? String(
                  (latest.termsJson as { deliveryNote?: string | null })
                    .deliveryNote ?? "",
                ) || null
              : null,
          deliveryImpact:
            typeof latest.termsJson === "object" &&
            latest.termsJson &&
            "deliveryImpact" in latest.termsJson
              ? String(
                  (latest.termsJson as { deliveryImpact?: string | null })
                    .deliveryImpact ?? "",
                ) || null
              : null,
          statusLabel: liveStatus.label,
          statusTone: liveStatus.tone,
        }
      : null;

  const unconfirmed = isAgreementUnconfirmed({
    agreementStatus: change.project.agreementStatus,
    currentScope: change.project.currentScope,
  });
  const analysisStatus = analysisStatusLabel(analysis);
  const headerTone = liveProposal
    ? liveProposal.statusTone
    : unconfirmed
      ? "clarify"
      : analysisStatus.tone;
  const headerLabel = liveProposal
    ? liveProposal.statusLabel
    : unconfirmed
      ? "Set up this project"
      : analysisStatus.label;
  const aiAssist = getAiAssistStatus(analysis);
  const paidLatest =
    latest?.payments.some((p) => p.status === PaymentStatus.CAPTURED) ?? false;
  const payoutRows = latest && paidLatest ? await getPayoutRows(latest.id) : [];
  const billingPanel =
    latest && latest.status === "ACCEPTED" && !latest.revokedAt
      ? await getBillingPanel(latest.id, user.id).catch(() => null)
      : null;

  return (
    <PageShell>
      <AppHeader />
      <PageMain>
        <div className="mb-6 space-y-3">
          <Link
            href={`/workspace/projects/${projectId}`}
            className="text-sm text-[color:var(--brand)] no-underline"
          >
            ← Back to project
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <PageHeader
              title={
                liveProposal ? "Published proposal" : "Review this request"
              }
              description={change.project.title}
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={headerTone}>{headerLabel}</StatusBadge>
              {!liveProposal ? (
                <ChangeActions
                  changeId={change.id}
                  projectId={projectId}
                  canDelete={canDeleteChangeRequest(change)}
                  canRevoke={canRevokeChangeRequest(change)}
                  locked={locked}
                  redirectToProject
                />
              ) : null}
            </div>
          </div>
        </div>

        <section className="surface-card p-5 md:p-6">
          <ReviewDecisionEditor
            key={
              locked
                ? `locked-${change.id}`
                : `edit-${change.id}-${change.analysisRevision}-${liveProposal?.id ?? "draft"}`
            }
            changeId={change.id}
            projectId={projectId}
            analysis={analysis}
            agreementScope={change.project.currentScope}
            agreementUnconfirmed={unconfirmed}
            openingRequest={cleanOpeningRequest(
              change.project.openingRequest || change.clientMessage,
            )}
            agreementSource={change.project.agreementSource}
            clientMessage={change.clientMessage}
            discussionNotes={change.discussionNotes}
            discussedPriceCents={change.discussedPriceCents}
            discussedDeliveryNote={change.discussedDeliveryNote}
            locked={locked}
            liveProposal={liveProposal}
            appUrl={appUrl}
            canRevoke={canRevokeChangeRequest(change)}
            aiCanRetry={aiAssist.canRetry}
            aiConfigIssue={aiAssist.configIssue}
          />
        </section>

        {payoutRows.length ? (
          <section className="surface-card mt-6 p-5 md:p-6">
            <PayoutsPanel proposalId={latest!.id} rows={payoutRows} />
          </section>
        ) : null}

        {latest && latest.status === "ACCEPTED" && !latest.revokedAt && !paidLatest ? (
          <section className="surface-card mt-6 p-5 md:p-6">
            <BillingAgentPanel
              proposalId={latest.id}
              initial={
                billingPanel
                  ? (JSON.parse(JSON.stringify(billingPanel)) as BillingPanelView)
                  : null
              }
            />
          </section>
        ) : null}
      </PageMain>
    </PageShell>
  );
}
