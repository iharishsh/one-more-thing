import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentStatus } from "@/generated/prisma/client";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AppHeader } from "@/components/app-header";
import { AttentionPanel } from "@/components/attention-panel";
import {
  PageHeader,
  PageMain,
  PageShell,
  SplitLayout,
} from "@/components/page-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AddRequestDialog } from "@/features/changes/components/add-request-dialog";
import { RequestLinkCard } from "@/features/intake/components/request-link-card";
import { SubcontractorsCard } from "@/features/billing/components/subcontractors-card";
import { RequestRow } from "@/features/changes/components/request-row";
import { toAttentionItem } from "@/features/changes/attention";
import {
  analysisStatusLabel,
  shortRequestTitle,
} from "@/features/changes/analysis-display";
import {
  canDeleteChangeRequest,
  canRevokeChangeRequest,
  getAnalysis,
} from "@/features/changes/change.service";
import { cleanOpeningRequest } from "@/features/changes/opening-request";
import { isAgreementUnconfirmed } from "@/features/changes/provisional-agreement";
import { ProjectSettingsDialog } from "@/features/projects/components/project-settings-dialog";
import { RecordAgreementDialog } from "@/features/projects/components/record-agreement-dialog";
import { AGREEMENT_STATUS_LABELS } from "@/features/projects/project.schema";
import type { ProjectStatusValue } from "@/features/projects/project.schema";
import { getProjectForOwner } from "@/features/projects/project.service";
import { requireFreelancer } from "@/server/auth";

function changeStatus(change: {
  clientMessage: string;
  proposals: Array<{
    status: string;
    priceCents: number;
    payments: Array<{ status: PaymentStatus }>;
  }>;
  analysisJson: unknown;
}) {
  const latest = change.proposals[0];
  if (!latest) {
    try {
      const analysis = getAnalysis(change);
      const status = analysisStatusLabel(analysis);
      return { label: status.label, tone: status.tone };
    } catch {
      /* ignore */
    }
    return { label: "Needs review", tone: "muted" as const };
  }
  if (latest.payments.some((p) => p.status === PaymentStatus.CAPTURED)) {
    return { label: "Payment received", tone: "paid" as const };
  }
  if (latest.status === "ACCEPTED")
    return { label: "Awaiting payment", tone: "warning" as const };
  if (latest.status === "PUBLISHED")
    return { label: "Awaiting client", tone: "default" as const };
  if (latest.status === "REVOKED")
    return { label: "Withdrawn", tone: "muted" as const };
  return { label: latest.status, tone: "muted" as const };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireFreelancer();

  let project;
  try {
    project = await getProjectForOwner(projectId, user.id);
  } catch {
    notFound();
  }

  const unconfirmed = isAgreementUnconfirmed({
    agreementStatus: project.agreementStatus,
    currentScope: project.currentScope,
  });

  const firstOpenChange = project.changeRequests.find((c) => {
    const latest = c.proposals[0];
    return !latest || latest.status === "REVOKED";
  });

  const attentionItems = project.changeRequests
    .map((change) =>
      toAttentionItem({
        ...change,
        project: {
          id: project.id,
          title: project.title,
          agreementStatus: project.agreementStatus,
        },
      }),
    )
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const agreementPreview = unconfirmed
    ? "No agreement recorded yet"
    : project.currentScope.replace(/\s+/g, " ").trim().slice(0, 160) +
      (project.currentScope.length > 160 ? "…" : "");

  const agreementLabel = unconfirmed
    ? "No agreement yet — record what’s already agreed, or prepare a first proposal"
    : `Agreement v${project.currentScopeVersion} · ${
        AGREEMENT_STATUS_LABELS[
          project.agreementStatus as keyof typeof AGREEMENT_STATUS_LABELS
        ] ?? project.agreementStatus
      }${
        project.revisionRoundsTotal != null
          ? ` · ${project.revisionRoundsUsed} of ${project.revisionRoundsTotal} revision rounds used`
          : ""
      }`;

  return (
    <PageShell>
      <AppHeader />
      <PageMain>
        <SplitLayout
          mobileSidebarFirst
          main={
            <>
              <div className="space-y-2">
                <Link
                  href="/workspace"
                  className="text-sm text-[color:var(--brand)] no-underline"
                >
                  ← Workspace
                </Link>
                <div className="flex items-start justify-between gap-3">
                  <PageHeader
                    title={project.title}
                    description={agreementLabel}
                    className="min-w-0 flex-1"
                  />
                  <ProjectSettingsDialog
                    projectId={project.id}
                    title={project.title}
                    status={project.status as ProjectStatusValue}
                  />
                </div>
              </div>

              {project.aiSummary ? (
                <section
                  aria-label="AI status"
                  className="rounded-[var(--radius-xl)] border border-[color:var(--brand)]/25 bg-[color:var(--brand)]/5 px-4 py-3"
                >
                  <p className="text-xs font-medium text-[color:var(--brand)]">
                    Where things stand
                  </p>
                  <p className="mt-1 text-sm tracking-body">{project.aiSummary}</p>
                </section>
              ) : null}

              {unconfirmed ? (
                <section className="space-y-3 rounded-[var(--radius-xl)] border border-amber-300 bg-amber-50 px-4 py-4 text-amber-950">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold tracking-normal">
                      Set up this project
                    </h2>
                    <p className="text-sm text-amber-900/90">
                      Add what you already agreed with your client, or prepare a
                      proposal for this new job.
                    </p>
                  </div>
                  {cleanOpeningRequest(project.openingRequest) ? (
                    <div className="rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Opening request
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {cleanOpeningRequest(project.openingRequest)}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <RecordAgreementDialog
                      projectId={project.id}
                      openingRequest={cleanOpeningRequest(project.openingRequest)}
                    />
                    {firstOpenChange ? (
                      <Link
                        href={`/workspace/projects/${project.id}/changes/${firstOpenChange.id}?setup=first-proposal`}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 text-xs font-medium"
                      >
                        Prepare first proposal
                      </Link>
                    ) : (
                      <AddRequestDialog
                        projects={[{ id: project.id, title: project.title }]}
                        defaultProjectId={project.id}
                        triggerLabel="Add request to propose"
                        triggerVariant="outline"
                      />
                    )}
                  </div>
                </section>
              ) : (
                <Accordion type="single" collapsible className="border-b border-border">
                  <AccordionItem value="agreement" className="border-0">
                    <AccordionTrigger className="rounded-none py-4 hover:no-underline">
                      <div className="min-w-0 flex-1 space-y-1 pr-2 text-left">
                        <span className="text-sm font-semibold tracking-normal">
                          Current agreement
                        </span>
                        <p className="text-sm font-normal text-muted-foreground group-aria-expanded/accordion-trigger:hidden">
                          {agreementPreview}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-3 text-sm leading-relaxed whitespace-pre-wrap">
                        {project.currentScope}
                      </div>
                      {project.agreementSource ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {project.agreementStatus === "FREELANCER_RECORDED"
                            ? "Recorded by you"
                            : "From client acceptance"}
                          {": "}
                          {project.agreementSource}
                          {project.agreementRecordedAt
                            ? ` · ${new Date(project.agreementRecordedAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      ) : null}
                      {project.deliverables.length > 0 ? (
                        <div className="mt-4 border-t border-border pt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Deliverables
                          </p>
                          <ul className="list-disc space-y-1 pl-5 text-sm">
                            {project.deliverables.map((d) => (
                              <li key={d.id}>{d.title}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <section className="space-y-1 pt-2">
                <h2 className="text-sm font-semibold tracking-normal">
                  Requests
                </h2>
                {project.changeRequests.length === 0 ? (
                  <p className="border-t border-border py-4 text-sm text-muted-foreground">
                    None yet. Add a client request when something new comes in.
                  </p>
                ) : (
                  <ul className="border-t border-border">
                    {project.changeRequests.map((change) => {
                      const status = changeStatus(change);
                      const latest = change.proposals[0];
                      let analysis = null;
                      try {
                        analysis = getAnalysis(change);
                      } catch {
                        analysis = null;
                      }
                      return (
                        <RequestRow
                          key={change.id}
                          changeId={change.id}
                          projectId={project.id}
                          title={shortRequestTitle(
                            analysis,
                            change.clientMessage,
                            88,
                          )}
                          statusLabel={
                            unconfirmed && !latest
                              ? "Set up project"
                              : status.label
                          }
                          statusTone={
                            unconfirmed && !latest ? "clarify" : status.tone
                          }
                          href={`/workspace/projects/${project.id}/changes/${change.id}`}
                          amountCents={latest?.priceCents}
                          canDelete={canDeleteChangeRequest(change)}
                          canRevoke={canRevokeChangeRequest(change)}
                        />
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          }
          sidebar={
            <>
              <AddRequestDialog
                projects={[{ id: project.id, title: project.title }]}
                defaultProjectId={project.id}
              />
              <AttentionPanel items={attentionItems} />
              <SubcontractorsCard
                projectId={project.id}
                subcontractors={project.subcontractors}
              />
              <RequestLinkCard
                projectId={project.id}
                initialToken={project.intakeToken}
                appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
              />
              <section className="space-y-3">
                <h2 className="text-sm font-semibold tracking-normal">
                  Recent activity
                </h2>
                <ActivityTimeline events={project.activityEvents} limit={3} />
              </section>
            </>
          }
        />
      </PageMain>
    </PageShell>
  );
}
