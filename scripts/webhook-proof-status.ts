import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { assertSandboxPaypalMode } from "./lib/reject-live-paypal";

assertSandboxPaypalMode("webhook-proof-status");

const proposalId = process.argv[2] ?? "cmutghhl90004js9510wo1q5m";
const projectId = process.argv[3] ?? "cmutghhkk0000js95ff7rqxhd";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const payments = await prisma.payment.findMany({
    where: { proposalId },
    orderBy: { createdAt: "desc" },
  });
  const deliverables = await prisma.deliverable.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  const activity = await prisma.activityEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  const webhooks = await prisma.webhookEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  console.log(
    JSON.stringify(
      {
        project: project
          ? {
              id: project.id,
              title: project.title,
              revisionRoundsUsed: project.revisionRoundsUsed,
              scopeHasMarker: project.currentScope.includes("Agreed change"),
            }
          : null,
        payments: payments.map((p) => ({
          id: p.id,
          status: p.status,
          paypalOrderId: p.paypalOrderId,
          paypalCaptureId: p.paypalCaptureId,
          proposalVersion: p.proposalVersion,
        })),
        deliverableCount: deliverables.length,
        deliverables: deliverables.map((d) => ({
          id: d.id,
          title: d.title,
          proposalId: d.proposalId,
        })),
        activityCount: activity.length,
        activity: activity.map((a) => ({
          id: a.id,
          kind: a.kind,
          message: a.message,
        })),
        webhooks: webhooks.map((w) => ({
          eventId: w.eventId,
          eventType: w.eventType,
          status: w.status,
          attemptCount: w.attemptCount,
          lastError: w.lastError,
          processedAt: w.processedAt,
        })),
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
