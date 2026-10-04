import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const c = await prisma.changeRequest.findFirst({
    where: { id: "cmur36pvp00001g9591s32gru" },
    select: { id: true, projectId: true },
  });
  console.log(c);
  await prisma.$disconnect();
  await pool.end();
}

main();
