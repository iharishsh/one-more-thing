import { beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { assertProjectOwner } from "@/server/access";
import { getProjectForOwner } from "@/features/projects/project.service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("ownership isolation", () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let ownerAId: string;
  let ownerBId: string;
  let projectAId: string;

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
});
