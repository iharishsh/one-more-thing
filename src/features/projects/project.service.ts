import type { Prisma } from "@/generated/prisma/client";
import {
  AgreementStatus,
  ProjectStatus,
} from "@/generated/prisma/client";
import { parseAgreementFacts } from "@/features/changes/agreement-facts";
import {
  createProjectSchema,
  projectStatusSchema,
  recordExistingAgreementSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type ProjectStatusValue,
  type RecordExistingAgreementInput,
  type UpdateProjectInput,
} from "@/features/projects/project.schema";
import { refreshProjectSummarySoon } from "@/features/projects/project-summary";
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
      subcontractors: { orderBy: { createdAt: "asc" } },
      deliverables: { orderBy: { createdAt: "asc" } },
      activityEvents: { orderBy: { createdAt: "desc" }, take: 30 },
      changeRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          proposals: {
            orderBy: { version: "desc" },
            include: {
              acceptance: true,
              payments: true,
              billingActions: {
                where: { status: "PROPOSED" },
                select: { status: true },
              },
            },
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
  const status = input.agreementStatus ?? "FREELANCER_RECORDED";
  const opening =
    status === "UNCONFIRMED"
      ? (input.openingRequest ?? input.originalScope).trim()
      : null;
  const scopeText =
    status === "UNCONFIRMED" ? "" : input.originalScope.trim();
  const facts = parseAgreementFacts({
    scope: scopeText,
    agreementStatus: status,
  });

  const recordedAt =
    status === "FREELANCER_RECORDED"
      ? input.agreementRecordedAt
        ? new Date(input.agreementRecordedAt)
        : new Date()
      : null;

  return prisma.project.create({
    data: {
      ownerId,
      title: input.title,
      status: input.status,
      agreementStatus: status as AgreementStatus,
      agreementSource:
        status === "FREELANCER_RECORDED"
          ? input.agreementSource?.trim() || "Entered when creating the project"
          : null,
      agreementRecordedAt: recordedAt,
      openingRequest: opening,
      originalScope: status === "UNCONFIRMED" ? opening || "" : scopeText,
      currentScope: scopeText,
      revisionRoundsTotal: facts.revisionRoundsTotal,
      revisionRoundsUsed: 0,
      deliverables: {
        create: input.deliverables.map((d) => ({ title: d.title })),
      },
      activityEvents: {
        create: {
          kind: "project.created",
          message:
            status === "UNCONFIRMED"
              ? `Created project “${input.title}” (no agreement yet)`
              : `Created project “${input.title}”`,
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
  if (input.openingRequest != null) data.openingRequest = input.openingRequest;
  if (input.agreementStatus != null) {
    data.agreementStatus = input.agreementStatus as AgreementStatus;
  }
  if (input.agreementSource !== undefined) {
    data.agreementSource = input.agreementSource;
  }
  if (input.agreementRecordedAt !== undefined) {
    data.agreementRecordedAt = input.agreementRecordedAt
      ? new Date(input.agreementRecordedAt)
      : null;
  }
  if (input.currentScope != null) {
    data.currentScope = input.currentScope;
    const facts = parseAgreementFacts({
      scope: input.currentScope,
      agreementStatus: input.agreementStatus ?? existing.agreementStatus,
    });
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

/** Freelancer records an existing outside-app agreement as the baseline. */
export async function recordExistingAgreement(
  projectId: string,
  ownerId: string,
  raw: RecordExistingAgreementInput,
) {
  const input = recordExistingAgreementSchema.parse(raw);
  const existing = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
  });
  if (!existing) throw new Error("Project not found");

  const recordedAt = new Date(input.agreementRecordedAt);
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error("Enter a valid agreement date");
  }

  const facts = parseAgreementFacts({
    scope: input.currentScope,
    agreementStatus: "FREELANCER_RECORDED",
  });

  const project = await prisma.$transaction(async (tx) => {
    if (input.deliverables?.length) {
      await tx.deliverable.deleteMany({ where: { projectId } });
      await tx.deliverable.createMany({
        data: input.deliverables.map((d) => ({
          projectId,
          title: d.title,
        })),
      });
    }

    return tx.project.update({
      where: { id: projectId },
      data: {
        currentScope: input.currentScope.trim(),
        originalScope:
          existing.agreementStatus === "UNCONFIRMED"
            ? input.currentScope.trim()
            : existing.originalScope,
        agreementStatus: AgreementStatus.FREELANCER_RECORDED,
        agreementSource: input.agreementSource.trim(),
        agreementRecordedAt: recordedAt,
        revisionRoundsTotal: facts.revisionRoundsTotal,
        ...(existing.agreementStatus === "UNCONFIRMED"
          ? { currentScopeVersion: Math.max(1, existing.currentScopeVersion) }
          : { currentScopeVersion: { increment: 1 } }),
      },
    });
  });

  await recordActivity(
    projectId,
    "agreement.recorded",
    `Recorded existing agreement (${input.agreementSource.trim()})`,
    {
      source: input.agreementSource.trim(),
      recordedAt: recordedAt.toISOString(),
      freelancerRecorded: true,
    },
  );

  return project;
}

export async function recordActivity(
  projectId: string,
  kind: string,
  message: string,
  metadata?: Prisma.InputJsonValue,
) {
  const event = await prisma.activityEvent.create({
    data: { projectId, kind, message, metadata },
  });
  refreshProjectSummarySoon(projectId);
  return event;
}
