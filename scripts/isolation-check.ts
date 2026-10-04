/**
 * Verifies ownership isolation between two Supabase-backed app users.
 * Uses server access helpers against the DB (same ownerId checks pages/APIs use).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function ensureUser(email: string, name: string, authSubject: string) {
  return prisma.user.upsert({
    where: { email },
    update: { authSubject, name },
    create: { email, name, authSubject },
  });
}

async function main() {
  const alex = await ensureUser(
    "alex.demo@example.com",
    "Alex Freelancer",
    "5144045b-dfbc-438b-9edb-96fafd65e06c",
  );
  const blake = await ensureUser(
    "blake.demo@example.com",
    "Blake Freelancer",
    "633b38dd-a65d-411d-a685-5583ea0b32dd",
  );

  const alexProject = await prisma.project.findFirst({
    where: { ownerId: alex.id },
    orderBy: { createdAt: "desc" },
  });
  if (!alexProject) throw new Error("Alex has no project");

  // Mirror listProjectsForOwner + getProjectForOwner patterns
  const blakeSeesAlex = await prisma.project.findFirst({
    where: { id: alexProject.id, ownerId: blake.id },
  });
  const blakeList = await prisma.project.findMany({
    where: { ownerId: blake.id },
    select: { id: true, title: true },
  });
  const alexList = await prisma.project.findMany({
    where: { ownerId: alex.id },
    select: { id: true, title: true },
  });

  console.log(
    JSON.stringify(
      {
        alex: { id: alex.id, email: alex.email, projectCount: alexList.length },
        blake: {
          id: blake.id,
          email: blake.email,
          projectCount: blakeList.length,
          projects: blakeList,
        },
        alexProjectId: alexProject.id,
        blakeCanLoadAlexProjectByOwnerFilter: Boolean(blakeSeesAlex),
        isolationOk: !blakeSeesAlex,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
