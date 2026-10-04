import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { assertSandboxPaypalMode } from "./lib/reject-live-paypal";

assertSandboxPaypalMode("check-payments");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const rows = await prisma.payment.findMany({
    include: { proposal: { select: { version: true, changeRequestId: true, status: true } } },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });
  console.log(JSON.stringify(rows.map((r) => ({
    status: r.status,
    changeId: r.proposal.changeRequestId,
    proposalStatus: r.proposal.status,
    version: r.proposal.version,
  })), null, 2));
  await prisma.$disconnect();
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
