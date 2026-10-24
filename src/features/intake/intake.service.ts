import "server-only";

import { z } from "zod";
import { ProjectStatus } from "@/generated/prisma/client";
import { startPrepareChange } from "@/features/agent/agent.service";
import { createChangeRequest } from "@/features/changes/change.service";
import { recordActivity } from "@/features/projects/project.service";
import { assertProjectOwner } from "@/server/access";
import { prisma } from "@/server/db";
import { createProposalToken } from "@/lib/tokens";

const INTAKE_PER_HOUR = 10;

export const clientIntakeSchema = z.object({
  clientName: z.string().trim().max(200).optional(),
  message: z.string().trim().min(5).max(5_000),
});

/** One stable link per project; created the first time the freelancer shares it. */
export async function ensureIntakeToken(projectId: string, ownerId: string) {
  const project = await assertProjectOwner(projectId, ownerId);
  if (project.intakeToken) return project.intakeToken;
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { intakeToken: createProposalToken() },
  });
  return updated.intakeToken!;
}

export async function getIntakeProject(token: string) {
  const project = await prisma.project.findUnique({
    where: { intakeToken: token },
    select: { id: true, title: true, status: true, ownerId: true },
  });
  if (!project || project.status === ProjectStatus.ARCHIVED) return null;
  return project;
}

/** Client submits a request directly. AI analyzes it and starts preparing a
 * draft; the freelancer only reviews what the agent prepared. */
export async function submitClientRequest(token: string, raw: unknown) {
  const input = clientIntakeSchema.parse(raw);
  const project = await getIntakeProject(token);
  if (!project) throw new Error("This request link is no longer active");

  // Public link: cap AI work per project so a leaked link can't run up costs.
  const recent = await prisma.activityEvent.count({
    where: {
      projectId: project.id,
      kind: "intake.received",
      createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
    },
  });
  if (recent >= INTAKE_PER_HOUR) {
    throw new Error("Too many requests on this link. Try again in an hour.");
  }

  const change = await createChangeRequest(project.ownerId, {
    projectId: project.id,
    clientMessage: input.message,
  });
  await recordActivity(
    project.id,
    "intake.received",
    `${input.clientName || "Your client"} sent a new request through your request link`,
    { changeRequestId: change.id },
  );

  try {
    await startPrepareChange(change.id, project.ownerId);
  } catch (error) {
    // Analysis is already stored; preparation can be started by hand.
    console.warn("[intake] auto-prepare failed", error);
  }
  return { received: true as const };
}
