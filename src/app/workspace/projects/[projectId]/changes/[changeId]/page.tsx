import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentStatus } from "@/generated/prisma/client";
import { AppHeader } from "@/components/app-header";
import {
  PageHeader,
  PageMain,
  PageShell,
  SplitLayout,
} from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { ChangeActions } from "@/features/changes/components/change-actions";
import { ReviewDecisionEditor } from "@/features/changes/components/review-decision-editor";
import {
  canDeleteChangeRequest,
  canRevokeChangeRequest,
  getAnalysis,
  getChangeForOwner,
  hasCapturedPayment,
} from "@/features/changes/change.service";
import { formatUsd } from "@/lib/money";
import { requireFreelancer } from "@/server/auth";

function proposalStatusLabel(
  status: string,
  payments: Array<{ status: PaymentStatus }>,
) {
  if (payments.some((p) => p.status === PaymentStatus.CAPTURED)) {
    return { label: "Payment received", tone: "paid" as const };
  }
  if (status === "ACCEPTED")
    return { label: "Awaiting payment", tone: "warning" as const };
  if (status === "PUBLISHED")
    return { label: "Awaiting client", tone: "default" as const };
  if (status === "REVOKED")
    return { label: "Withdrawn", tone: "muted" as const };
  if (status === "SUPERSEDED")
    return { label: "Superseded", tone: "muted" as const };
  return { label: status, tone: "muted" as const };
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
  const outcomeTone =
    analysis.primaryOutcome === "clarify"
      ? "clarify"
      : analysis.primaryOutcome === "included"
        ? "included"
        : analysis.primaryOutcome === "additional"
          ? "additional"
          : "default";

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
              title="Review request"
              description={change.project.title}
            />
            <ChangeActions
              changeId={change.id}
              projectId={projectId}
              canDelete={canDeleteChangeRequest(change)}
              canRevoke={canRevokeChangeRequest(change)}
              locked={locked}
              redirectToProject
            />
          </div>
        </div>

        <SplitLayout
          main={
            <>
              <section className="surface-card space-y-3 p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Client message
                  </p>
                  <StatusBadge tone={outcomeTone}>
                    {analysis.primaryOutcome === "clarify"
                      ? "Needs clarification"
                      : analysis.primaryOutcome === "included"
                        ? "Likely included"
                        : analysis.primaryOutcome === "additional"
                          ? "Suggested additional work"
                          : "Mixed"}
                  </StatusBadge>
                </div>
                <p className="whitespace-pre-wrap text-base leading-relaxed tracking-body">
                  {change.clientMessage}
                </p>
              </section>

              <section className="surface-card p-5 md:p-6">
                <ReviewDecisionEditor
                  key={locked ? `locked-${change.id}` : `edit-${change.id}`}
                  changeId={change.id}
                  analysis={analysis}
                  agreementScope={change.project.currentScope}
                  locked={locked}
                />
              </section>
            </>
          }
          sidebar={
            <>
              <section className="surface-card space-y-3 p-4">
                <h2 className="text-subhead">Published versions</h2>
                {change.proposals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No proposal published yet.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {change.proposals.map((proposal) => {
                      const status = proposalStatusLabel(
                        proposal.status,
                        proposal.payments,
                      );
                      return (
                        <li
                          key={proposal.id}
                          className="rounded-[var(--radius-lg)] bg-[color:var(--brand-soft)] p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              v{proposal.version}
                            </span>
                            <StatusBadge tone={status.tone}>
                              {status.label}
                            </StatusBadge>
                            {proposal.priceCents > 0 ? (
                              <span className="text-money">
                                {formatUsd(proposal.priceCents)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 break-all text-xs text-muted-foreground">
                            {appUrl}/proposal/{proposal.clientToken}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <section className="rounded-[var(--radius-xl)] bg-[color:var(--brand-soft)] p-4 text-sm text-muted-foreground">
                Quotes prove the words exist. You still decide the
                classification and any price before publishing.
              </section>
            </>
          }
        />
      </PageMain>
    </PageShell>
  );
}
