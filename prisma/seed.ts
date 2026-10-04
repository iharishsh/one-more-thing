import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function ensureProject(args: {
  ownerId: string;
  title: string;
  scope: string;
  deliverables: string[];
}) {
  const existing = await prisma.project.findFirst({
    where: { ownerId: args.ownerId, title: args.title },
  });
  if (existing) {
    await prisma.project.update({
      where: { id: existing.id },
      data: {
        originalScope: args.scope,
        revisionRoundsTotal: existing.revisionRoundsTotal ?? 2,
      },
    });
    return existing;
  }

  return prisma.project.create({
    data: {
      ownerId: args.ownerId,
      title: args.title,
      originalScope: args.scope,
      currentScope: args.scope,
      revisionRoundsTotal: 2,
      revisionRoundsUsed: 0,
      deliverables: {
        create: args.deliverables.map((title) => ({ title })),
      },
      activityEvents: {
        create: [
          { kind: "project.created", message: "Project created from seed" },
        ],
      },
    },
  });
}

async function main() {
  const ownerA = await prisma.user.upsert({
    where: { email: "freelancer@example.com" },
    update: { name: "Demo Freelancer A" },
    create: {
      email: "freelancer@example.com",
      name: "Demo Freelancer A",
    },
  });

  const ownerB = await prisma.user.upsert({
    where: { email: "freelancer-b@example.com" },
    update: { name: "Demo Freelancer B" },
    create: {
      email: "freelancer-b@example.com",
      name: "Demo Freelancer B",
    },
  });

  await ensureProject({
    ownerId: ownerA.id,
    title: "Landing page redesign",
    scope:
      "Design and ship a responsive marketing landing page with hero, features, and contact form.\nIncludes two revision rounds.\nDoes not include blog, SEO packages, or ongoing content.",
    deliverables: ["Hero section design", "Features section", "Contact form"],
  });

  // Broader agreement — same client ask may be "included" here vs additional on landing.
  await ensureProject({
    ownerId: ownerA.id,
    title: "Full marketing site + content",
    scope:
      "Build a full marketing website including landing pages, blog with CMS, SEO landing pages, and dark mode across the site.\nIncludes three revision rounds.\nClient provides final copy.",
    deliverables: [
      "Marketing site pages",
      "Blog with CMS",
      "SEO landing pages",
      "Dark mode",
    ],
  });

  // Isolation demo: B must not see A's projects
  await ensureProject({
    ownerId: ownerB.id,
    title: "B-only consulting retainer",
    scope:
      "Monthly consulting retainer for product strategy calls.\nDoes not include implementation, design, or code.",
    deliverables: ["Weekly strategy call notes"],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
