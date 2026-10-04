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
import { StatusBadge } from "@/components/status-badge";
import { AddRequestDialog } from "@/features/changes/components/add-request-dialog";
import { ChangeActions } from "@/features/changes/components/change-actions";
import { RequestInput } from "@/features/changes/components/request-input";
import {
  canDeleteChangeRequest,
  canRevokeChangeRequest,
  getAnalysis,
} from "@/features/changes/change.service";
import { ProjectSettingsDialog } from "@/features/projects/components/project-settings-dialog";
import type { ProjectStatusValue } from "@/features/projects/project.schema";
import { getProjectForOwner } from "@/features/projects/project.service";
import { formatUsd } from "@/lib/money";
import { requireFreelancer } from "@/server/auth";

function splitAgreement(scope: string) {
  return scope
    .split(/\n+|(?=--- )/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function changeStatus(change: {
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
      if (analysis.primaryOutcome === "clarify")
        return { label: "Needs clarification", tone: "clarify" as const };
      if (analysis.primaryOutcome === "included")
        return { label: "Likely included", tone: "included" as const };
      if (analysis.primaryOutcome === "additional")
        return { label: "Ready to propose", tone: "additional" as const };
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

  const agreementParts = splitAgreement(project.currentScope);
  const attentionItems = project.changeRequests
    .filter((change) => {
      const latest = change.proposals[0];
      if (!latest) return true;
      const paid = latest.payments.some(
        (p) => p.status === PaymentStatus.CAPTURED,
      );
      return !paid && latest.status !== "REVOKED";
    })
    .slice(0, 6)
    .map((change) => {
      const status = changeStatus(change);
      return {
        id: change.id,
        projectTitle: project.title,
        summary:
          change.clientMessage.length > 80
            ? `${change.clientMessage.slice(0, 80)}…`
            : change.clientMessage,
        statusLabel: status.label,
        href: `/workspace/projects/${project.id}/changes/${change.id}`,
      };
    });

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
                    description={`Agreement version ${project.currentScopeVersion}${
                      project.revisionRoundsTotal != null
                        ? ` · Revisions ${project.revisionRoundsUsed}/${project.revisionRoundsTotal} used`
                        : ""
                    }`}
                    className="min-w-0 flex-1"
                  />
                  <ProjectSettingsDialog
                    projectId={project.id}
                    title={project.title}
                    status={project.status as ProjectStatusValue}
                  />
                </div>
              </div>

              <section className="surface-card space-y-4 p-5 md:p-6">
                <h2 className="text-subhead">Current agreement</h2>
                <div className="space-y-3 text-base leading-relaxed tracking-body">
                  {agreementParts.map((part, index) => (
                    <p
                      key={`${index}-${part.slice(0, 24)}`}
                      className={
                        part.startsWith("---")
                          ? "rounded-[var(--radius-lg)] bg-[color:var(--brand-soft)] px-3 py-2 text-sm"
                          : "whitespace-pre-wrap"
                      }
                    >
                      {part}
                    </p>
                  ))}
                </div>
                {project.deliverables.length > 0 ? (
                  <div className="border-t border-border pt-4">
                    <p className="mb-2 text-sm font-semibold">Deliverables</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm tracking-body">
                      {project.deliverables.map((d) => (
                        <li key={d.id}>
                          {d.title}
                          {d.proposalId ? (
                            <span className="text-muted-foreground">
                              {" "}
                              (from agreed change)
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="surface-card space-y-3 p-5 md:p-6" id="add-request">
                <h2 className="text-subhead">Add client request</h2>
                <p className="text-sm text-muted-foreground">
                  Paste what the client asked. You’ll decide whether it’s
                  included, needs clarification, or additional work.
                </p>
                <RequestInput projectId={project.id} />
              </section>

              <section className="space-y-3">
                <h2 className="text-subhead">Change requests</h2>
                {project.changeRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {project.changeRequests.map((change) => {
                      const status = changeStatus(change);
                      const latest = change.proposals[0];
                      return (
                        <li
                          key={change.id}
                          className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            <Link
                              href={`/workspace/projects/${project.id}/changes/${change.id}`}
                              className="text-base font-semibold tracking-body text-foreground no-underline hover:text-[color:var(--brand-bright)]"
                            >
                              {change.clientMessage.slice(0, 160)}
                              {change.clientMessage.length > 160 ? "…" : ""}
                            </Link>
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge tone={status.tone}>
                                {status.label}
                              </StatusBadge>
                              {latest && latest.priceCents > 0 ? (
                                <span className="text-sm text-muted-foreground">
                                  {formatUsd(latest.priceCents)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <ChangeActions
                            changeId={change.id}
                            projectId={project.id}
                            canDelete={canDeleteChangeRequest(change)}
                            canRevoke={canRevokeChangeRequest(change)}
                          />
                        </li>
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
              <section className="space-y-3">
                <h2 className="text-subhead">Recent activity</h2>
                <div className="surface-card max-h-[50vh] overflow-auto p-4">
                  <ActivityTimeline events={project.activityEvents} limit={8} />
                </div>
              </section>
            </>
          }
        />
      </PageMain>
    </PageShell>
  );
}
