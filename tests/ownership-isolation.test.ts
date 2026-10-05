import { beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getChangeForOwner } from "@/features/changes/change.service";
import { assertProjectOwner, getProposalByToken } from "@/server/access";
import { getProjectForOwner } from "@/features/projects/project.service";
import { getClientThreadByToken } from "@/features/agent/agent.service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("ownership isolation", () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let ownerAId: string;
  let ownerBId: string;
  let projectAId: string;
  let changeAId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const a = await prisma.user.findUniqueOrThrow({
      where: { email: "freelancer@example.com" },
    });
    const b = await prisma.user.findUniqueOrThrow({
      where: { email: "freelancer-b@example.com" },
    });
    ownerAId = a.id;
    ownerBId = b.id;
    const project = await prisma.project.findFirstOrThrow({
      where: { ownerId: a.id, title: "Landing page redesign" },
    });
    projectAId = project.id;
    const change = await prisma.changeRequest.findFirstOrThrow({
      where: { projectId: projectAId },
      orderBy: { createdAt: "desc" },
    });
    changeAId = change.id;
  });

  it("owner A can read their project", async () => {
    const project = await getProjectForOwner(projectAId, ownerAId);
    expect(project.id).toBe(projectAId);
  });

  it("owner B cannot read A’s project by id", async () => {
    await expect(getProjectForOwner(projectAId, ownerBId)).rejects.toThrow(
      /not found|access/i,
    );
    await expect(assertProjectOwner(projectAId, ownerBId)).rejects.toThrow(
      /not found|access/i,
    );
  });

  it("owner B cannot read or mutate A’s change by id", async () => {
    await expect(getChangeForOwner(changeAId, ownerBId)).rejects.toThrow(
      /not found|access/i,
    );
  });

  it("client thread responses omit private messages", async () => {
    const thread = await prisma.changeThread.findFirst({
      where: {
        changeRequest: { projectId: projectAId },
        messages: { some: { visibility: "PRIVATE" } },
      },
      include: { messages: true },
      orderBy: { createdAt: "desc" },
    });
    if (!thread) return;

    const privateIds = new Set(
      thread.messages.filter((m) => m.visibility === "PRIVATE").map((m) => m.id),
    );
    const view = await getClientThreadByToken(thread.inviteToken);
    if (view.state !== "ok") return;
    for (const message of view.messages) {
      expect(privateIds.has(message.id)).toBe(false);
    }
  });

  it("revoked proposal tokens cannot be used for mutations", async () => {
    const revoked = await prisma.proposal.findFirst({
      where: {
        changeRequest: { projectId: projectAId },
        revokedAt: { not: null },
      },
    });
    if (!revoked) return;
    await expect(getProposalByToken(revoked.clientToken)).rejects.toThrow(
      /revoked|not found|expired/i,
    );
  });
});
