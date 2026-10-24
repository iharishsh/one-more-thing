import Link from "next/link";
import { getProjectStatusLine } from "@/features/projects/project-summary";
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
import { toAttentionItem } from "@/features/changes/attention";
import { WorkspaceDigestStrip } from "@/features/projects/components/workspace-digest-strip";
import { getWorkspaceDigest } from "@/features/projects/workspace-digest";
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
            some: { billingActions: { some: { status: "PROPOSED" } } },
          },
        },
        {
          proposals: {
            some: {
              status: {
                in: [
                  ProposalStatus.PUBLISHED,
                  ProposalStatus.ACCEPTED,
                  ProposalStatus.DECLINED,
                  ProposalStatus.CHANGES_REQUESTED,
                ],
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
        include: {
          payments: true,
          acceptance: true,
          billingActions: { where: { status: "PROPOSED" }, select: { status: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 24,
  });

  const digest = await getWorkspaceDigest(user.id);
  const statusLines = new Map(
    await Promise.all(
      projects.map(
        async (p) => [p.id, await getProjectStatusLine(p.id)] as const,
      ),
    ),
  );

  const recentActivity = await prisma.activityEvent.findMany({
    where: { project: { ownerId: user.id } },
    include: { project: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const attentionItems = attention
    .map((change) => toAttentionItem(change))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

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

              <WorkspaceDigestStrip digest={digest} />

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
                <ul className="border-t border-border">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <ProjectCard
                        href={`/workspace/projects/${project.id}`}
                        title={project.title}
                        meta={
                          statusLines.get(project.id) ??
                          `${project._count.changeRequests} request${project._count.changeRequests === 1 ? "" : "s"} · Agreement v${project.currentScopeVersion}`
                        }
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
                <h2 className="text-sm font-semibold tracking-normal">
                  Recent activity
                </h2>
                <ActivityTimeline
                  events={recentActivity.map((e) => ({
                    ...e,
                    projectTitle: e.project.title,
                  }))}
                  limit={3}
                  viewAllHref="/workspace/activity"
                />
              </section>
            </>
          }
        />
      </PageMain>
    </PageShell>
  );
}
