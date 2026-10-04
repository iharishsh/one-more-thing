import type { Prisma } from "@/generated/prisma/client";
import { ProjectStatus } from "@/generated/prisma/client";
import { parseAgreementFacts } from "@/features/changes/agreement-facts";
import {
  createProjectSchema,
  projectStatusSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type ProjectStatusValue,
  type UpdateProjectInput,
} from "@/features/projects/project.schema";
import { prisma } from "@/server/db";

export async function listProjectsForOwner(
  ownerId: string,
  options?: { status?: ProjectStatusValue | "ALL" },
) {
  const statusFilter =
    !options?.status || options.status === "ALL"
      ? undefined
      : projectStatusSchema.parse(options.status);

  return prisma.project.findMany({
    where: {
      ownerId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { changeRequests: true, deliverables: true } },
    },
  });
}

export async function getProjectForOwner(projectId: string, ownerId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
    include: {
      deliverables: { orderBy: { createdAt: "asc" } },
      activityEvents: { orderBy: { createdAt: "desc" }, take: 30 },
      changeRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          proposals: {
            orderBy: { version: "desc" },
            include: { acceptance: true, payments: true },
          },
        },
      },
    },
  });
  if (!project) throw new Error("Project not found");
  return project;
}

export async function createProject(ownerId: string, raw: CreateProjectInput) {
  const input = createProjectSchema.parse(raw);
  const facts = parseAgreementFacts({ scope: input.originalScope });

  return prisma.project.create({
    data: {
      ownerId,
      title: input.title,
      status: input.status,
      originalScope: input.originalScope,
      currentScope: input.originalScope,
      revisionRoundsTotal: facts.revisionRoundsTotal,
      revisionRoundsUsed: 0,
      deliverables: {
        create: input.deliverables.map((d) => ({ title: d.title })),
      },
      activityEvents: {
        create: {
          kind: "project.created",
          message: `Created project “${input.title}”`,
        },
      },
    },
  });
}

export async function updateProject(
  projectId: string,
  ownerId: string,
  raw: UpdateProjectInput,
) {
  const input = updateProjectSchema.parse(raw);
  const existing = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
  });
  if (!existing) throw new Error("Project not found");

  const data: Prisma.ProjectUpdateInput = {};
  if (input.title != null) data.title = input.title;
  if (input.status != null) data.status = input.status as ProjectStatus;
  if (input.currentScope != null) {
    data.currentScope = input.currentScope;
    const facts = parseAgreementFacts({ scope: input.currentScope });
    data.revisionRoundsTotal = facts.revisionRoundsTotal;
  }
  if (input.originalScope != null) data.originalScope = input.originalScope;

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
  });

  if (input.status && input.status !== existing.status) {
    await recordActivity(
      projectId,
      "project.status",
      `Status set to ${input.status.replaceAll("_", " ").toLowerCase()}`,
      { from: existing.status, to: input.status },
    );
  }

  return project;
}

export async function recordActivity(
  projectId: string,
  kind: string,
  message: string,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.activityEvent.create({
    data: { projectId, kind, message, metadata },
  });
}
