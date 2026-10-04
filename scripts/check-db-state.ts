import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, authSubject: true, name: true },
  });
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, ownerId: true },
  });
  const payments = await prisma.payment.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      proposal: {
        select: {
          clientToken: true,
          status: true,
          version: true,
          priceCents: true,
          changeRequest: { select: { projectId: true } },
        },
      },
    },
  });
  const proposals = await prisma.proposal.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clientToken: true,
      status: true,
      version: true,
      priceCents: true,
      changeRequest: { select: { projectId: true } },
    },
  });
  const webhooks = await prisma.webhookEvent.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
  });
  const deliverables = await prisma.deliverable.findMany({
    take: 30,
    select: { id: true, title: true, projectId: true, completed: true },
  });
  const activity = await prisma.activityEvent.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, message: true, projectId: true },
  });

  console.log(
    JSON.stringify(
      { users, projects, payments, proposals, webhooks, deliverables, activity },
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
