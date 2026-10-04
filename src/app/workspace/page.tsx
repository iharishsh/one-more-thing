import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AttentionPanel } from "@/components/attention-panel";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ProjectCard } from "@/components/project-card";
import {
  EmptyState,
  PageMain,
  PageShell,
  SplitLayout,
} from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { AddRequestDialog } from "@/features/changes/components/add-request-dialog";
import { getAnalysis } from "@/features/changes/change.service";
import { WorkspaceStatusFilter } from "@/features/projects/components/workspace-status-filter";
import {
  PROJECT_STATUS_LABELS,
  projectStatusSchema,
  type ProjectStatusValue,
} from "@/features/projects/project.schema";
import { listProjectsForOwner } from "@/features/projects/project.service";
import { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { prisma } from "@/server/db";
import { requireFreelancer } from "@/server/auth";

function parseStatusFilter(
  raw: string | undefined,
): "ALL" | ProjectStatusValue {
  if (!raw || raw === "ACTIVE") return "ACTIVE";
  if (raw === "ALL") return "ALL";
  const parsed = projectStatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : "ACTIVE";
}

function attentionStatus(change: {
  analysisJson: unknown;
  proposals: Array<{
    acceptance: unknown;
    payments: Array<{ status: PaymentStatus }>;
  }>;
}) {
  try {
    const analysis = getAnalysis(change);
    if (!change.proposals[0]) {
      if (analysis.primaryOutcome === "clarify") return "Needs clarification";
      if (analysis.primaryOutcome === "included") return "Confirm included work";
      if (analysis.primaryOutcome === "additional") return "Prepare proposal";
      return "Needs review";
    }
    if (
      change.proposals[0].payments.some(
        (p) => p.status === PaymentStatus.CAPTURED,
      )
    ) {
      return "Payment received";
    }
    if (change.proposals[0].acceptance) return "Awaiting payment";
    return "Awaiting client";
  } catch {
    return "Needs review";
  }
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const statusFilter = parseStatusFilter(statusParam);
  const user = await requireFreelancer();
  const [projects, allActiveProjects] = await Promise.all([
    listProjectsForOwner(user.id, { status: statusFilter }),
    listProjectsForOwner(user.id, { status: "ACTIVE" }),
  ]);

  const attention = await prisma.changeRequest.findMany({
    where: {
      project: { ownerId: user.id },
      OR: [
        { proposals: { none: {} } },
        {
          proposals: {
            some: {
              status: {
                in: [ProposalStatus.PUBLISHED, ProposalStatus.ACCEPTED],
              },
              payments: {
                none: { status: PaymentStatus.CAPTURED },
              },
              revokedAt: null,
            },
          },
        },
      ],
    },
    include: {
      project: { select: { id: true, title: true } },
      proposals: {
        orderBy: { version: "desc" },
        take: 1,
        include: { payments: true, acceptance: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  const recentActivity = await prisma.activityEvent.findMany({
    where: { project: { ownerId: user.id } },
    include: { project: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const attentionItems = attention.map((change) => ({
    id: change.id,
    projectTitle: change.project.title,
    summary:
      change.clientMessage.length > 80
        ? `${change.clientMessage.slice(0, 80)}…`
        : change.clientMessage,
    statusLabel: attentionStatus(change),
    href: `/workspace/projects/${change.project.id}/changes/${change.id}`,
  }));

  return (
    <PageShell>
      <AppHeader />
      <PageMain>
        <SplitLayout
          mobileSidebarFirst
          main={
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-heading">Workspace</span>
                  <span
                    className="text-subhead translate-y-px text-foreground/35"
                    aria-hidden
                  >
                    ·
                  </span>
                  <span className="text-subhead text-foreground">Projects</span>
                </h1>
                <WorkspaceStatusFilter value={statusFilter} />
              </div>

              {projects.length === 0 ? (
                <EmptyState
                  title={
                    statusFilter === "ALL" || statusFilter === "ACTIVE"
                      ? "No projects yet"
                      : `No ${PROJECT_STATUS_LABELS[statusFilter].toLowerCase()} projects`
                  }
                  description={
                    statusFilter === "ALL" || statusFilter === "ACTIVE"
                      ? "Create a project to capture the original agreement, then paste client requests as they arrive."
                      : "Try another status filter, or update a project’s status in its settings."
                  }
                  action={
                    <Link
                      href="/workspace/projects/new"
                      className={cn(
                        buttonVariants({ variant: "brand" }),
                        "no-underline",
                      )}
                    >
                      New project
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-4">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <ProjectCard
                        href={`/workspace/projects/${project.id}`}
                        title={project.title}
                        meta={`Agreement v${project.currentScopeVersion} · ${project._count.changeRequests} request${project._count.changeRequests === 1 ? "" : "s"} · ${project._count.deliverables} deliverable${project._count.deliverables === 1 ? "" : "s"}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          }
          sidebar={
            <>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/workspace/projects/new"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full no-underline",
                  )}
                >
                  New project
                </Link>
                <AddRequestDialog
                  projects={allActiveProjects.map((p) => ({
                    id: p.id,
                    title: p.title,
                  }))}
                />
              </div>

              <AttentionPanel items={attentionItems} />

              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-[-0.04em]">
                  Recent activity
                </h2>
                <div className="surface-card p-4">
                  <ActivityTimeline
                    events={recentActivity.map((e) => ({
                      ...e,
                      projectTitle: e.project.title,
                    }))}
                    limit={3}
                    viewAllHref="/workspace/activity"
                  />
                </div>
              </section>
            </>
          }
        />
      </PageMain>
    </PageShell>
  );
}
