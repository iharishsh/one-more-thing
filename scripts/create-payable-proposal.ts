/**
 * Creates a fresh ACCEPTED, unpaid proposal for webhook payment verification.
 * Sandbox-only — refuses PAYPAL_MODE=live.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { nanoid } from "nanoid";
import {
  ProposalStatus,
  PrismaClient,
} from "../src/generated/prisma/client";
import { assertSandboxPaypalMode } from "./lib/reject-live-paypal";

assertSandboxPaypalMode("create-payable-proposal");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const owner = await prisma.user.findUnique({
    where: { email: "alex.demo@example.com" },
  });
  if (!owner) throw new Error("alex.demo@example.com user missing — sign up first");

  const project = await prisma.project.create({
    data: {
      ownerId: owner.id,
      title: `Webhook verify ${new Date().toISOString().slice(0, 16)}`,
      originalScope: "Small paid change for webhook verification.",
      currentScope: "Small paid change for webhook verification.",
      revisionRoundsTotal: 2,
      revisionRoundsUsed: 0,
      deliverables: {
        create: [{ title: "Baseline deliverable" }],
      },
      activityEvents: {
        create: [
          {
            kind: "project.created",
            message: "Created for webhook verification",
          },
        ],
      },
    },
  });

  const change = await prisma.changeRequest.create({
    data: {
      projectId: project.id,
      clientMessage: "Please add a one-page FAQ for $25 sandbox test.",
      scopeVersionAnalyzed: 1,
    },
  });

  const clientToken = nanoid(32);
  const proposal = await prisma.proposal.create({
    data: {
      changeRequestId: change.id,
      version: 1,
      status: ProposalStatus.ACCEPTED,
      summary: "Add FAQ page — sandbox webhook test ($25)",
      priceCents: 2500,
      currency: "USD",
      clientToken,
      tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      termsJson: {
        selectedOption: {
          kind: "extra_price",
          summary: "Add FAQ page",
          priceCents: 2500,
        },
        deliverableChanges: [
          { title: "FAQ page", description: "Webhook verification deliverable" },
        ],
        completionCriteria: "FAQ page published",
        exclusions: "No SEO",
      },
      acceptance: {
        create: {
          proposalVersion: 1,
          clientName: "Sandbox Client",
          acknowledgment: "I accept these terms for webhook verification.",
        },
      },
    },
  });

  await prisma.activityEvent.create({
    data: {
      projectId: project.id,
      kind: "proposal.accepted",
      message: "Client accepted proposal v1 (webhook test setup)",
    },
  });

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/proposal/${clientToken}`;
  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        proposalId: proposal.id,
        clientToken,
        priceCents: proposal.priceCents,
        localUrl: `http://localhost:3000/proposal/${clientToken}`,
        publicUrl: url,
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
