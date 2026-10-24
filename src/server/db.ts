import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function createPrismaClient() {
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase's session pooler allows ~15 clients in total; leave room for
      // other processes (tests, scripts, a second instance).
      max: Number(process.env.DATABASE_POOL_MAX ?? "5") || 5,
      idleTimeoutMillis: 10_000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
