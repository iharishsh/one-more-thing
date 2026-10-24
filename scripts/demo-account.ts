/* eslint-disable @typescript-eslint/no-unused-vars -- destructuring drops ids/foreign keys before copying rows */
/**
 * Creates (or resets) the shared judge demo account by copying a curated
 * template workspace into it. Safe to rerun: the demo account's data is
 * replaced each time.
 *
 *   pnpm demo:reset
 *
 * Env: DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD (generated into .env when
 * missing), DEMO_TEMPLATE_EMAIL (the account to copy, default
 * shanksstudio@example.com), SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_EMAIL = (
  process.env.DEMO_ACCOUNT_EMAIL ?? "judge-demo@example.com"
).toLowerCase();
const DEMO_NAME = process.env.DEMO_ACCOUNT_NAME ?? "Shanks Studio";
const TEMPLATE_EMAIL = (
  process.env.DEMO_TEMPLATE_EMAIL ?? "shanksstudio@example.com"
).toLowerCase();

function demoPassword() {
  if (process.env.DEMO_ACCOUNT_PASSWORD) return process.env.DEMO_ACCOUNT_PASSWORD;
  const generated = randomBytes(18).toString("base64url");
  appendFileSync(
    ".env",
    `\n# Shared judge demo account (server-only, never sent to the browser)\nDEMO_ACCOUNT_EMAIL="${DEMO_EMAIL}"\nDEMO_ACCOUNT_PASSWORD="${generated}"\n`,
  );
  console.log("Generated DEMO_ACCOUNT_PASSWORD and saved it to .env");
  return generated;
}

async function ensureAuthUser(password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase admin credentials missing");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing?.authSubject) {
    // Leave credentials alone when they still work: setting a password signs
    // out everyone currently using the demo.
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      const probe = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error } = await probe.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password,
      });
      if (!error) return existing.authSubject;
    }
    const { error } = await admin.auth.admin.updateUserById(existing.authSubject, {
      email: DEMO_EMAIL,
      password,
      email_confirm: true,
    });
    if (!error) return existing.authSubject;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: DEMO_NAME },
  });
  if (error || !data.user) throw new Error(`Supabase: ${error?.message}`);
  return data.user.id;
}

async function wipe(ownerId: string) {
  const projects = await prisma.project.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);
  const proposalFilter = { changeRequest: { projectId: { in: projectIds } } };
  await prisma.$transaction([
    prisma.deliverable.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.payment.deleteMany({ where: { proposal: proposalFilter } }),
    prisma.acceptance.deleteMany({ where: { proposal: proposalFilter } }),
    prisma.clientResponse.deleteMany({ where: { proposal: proposalFilter } }),
    prisma.proposal.deleteMany({ where: proposalFilter }),
    prisma.changeRequest.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.activityEvent.deleteMany({ where: { projectId: { in: projectIds } } }),
    prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
  ]);
}

/** Nullable JSON columns: keep SQL NULL as NULL. */
const json = (value: Prisma.JsonValue | null | undefined) =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
/** Required JSON columns. */
const jsonRequired = (value: Prisma.JsonValue) => value as Prisma.InputJsonValue;

async function cloneWorkspace(templateOwnerId: string, ownerId: string) {
  const projects = await prisma.project.findMany({
    where: { ownerId: templateOwnerId, status: { not: "ARCHIVED" } },
    include: {
      deliverables: true,
      activityEvents: true,
      subcontractors: true,
      changeRequests: {
        include: {
          changeThread: { include: { messages: true } },
          proposals: {
            include: {
              acceptance: true,
              clientResponses: true,
              payments: true,
              billingActions: true,
            },
          },
        },
      },
    },
  });

  for (const src of projects) {
    const {
      id: _id,
      ownerId: _o,
      deliverables,
      activityEvents,
      changeRequests,
      subcontractors,
      ...data
    } = src;
    const project = await prisma.project.create({
      data: { ...data, ownerId, intakeToken: nanoid(32) },
    });
    const subIds = new Map<string, string>();
    for (const { id: subId, projectId: _sp, ...sub } of subcontractors) {
      const copy = await prisma.subcontractor.create({
        data: { ...sub, projectId: project.id },
      });
      subIds.set(subId, copy.id);
    }
    const proposalIds = new Map<string, string>();

    for (const cr of changeRequests) {
      const { id: _c, projectId: _p, changeThread, proposals, analysisJson, ...crData } = cr;
      const change = await prisma.changeRequest.create({
        data: { ...crData, analysisJson: json(analysisJson), projectId: project.id },
      });
      if (changeThread) {
        await prisma.changeThread.create({
          data: {
            changeRequestId: change.id,
            inviteToken: nanoid(32),
            autoClarify: changeThread.autoClarify,
            revokedAt: changeThread.revokedAt,
            messages: {
              create: changeThread.messages.map((m) => ({
                kind: m.kind,
                visibility: m.visibility,
                body: m.body,
                metadataJson: json(m.metadataJson),
                idempotencyKey: m.idempotencyKey,
                createdAt: m.createdAt,
              })),
            },
          },
        });
      }
      for (const p of cr.proposals) {
        const proposal = await prisma.proposal.create({
          data: {
            changeRequestId: change.id,
            version: p.version,
            status: p.status,
            summary: p.summary,
            termsJson: jsonRequired(p.termsJson),
            priceCents: p.priceCents,
            currency: p.currency,
            clientToken: nanoid(32),
            tokenExpiresAt: p.tokenExpiresAt,
            revokedAt: p.revokedAt,
            createdAt: p.createdAt,
            ...(p.acceptance
              ? {
                  acceptance: {
                    create: {
                      proposalVersion: p.acceptance.proposalVersion,
                      clientName: p.acceptance.clientName,
                      clientEmail: p.acceptance.clientEmail,
                      acknowledgment: p.acceptance.acknowledgment,
                      acceptedAt: p.acceptance.acceptedAt,
                    },
                  },
                }
              : {}),
            clientResponses: {
              create: p.clientResponses.map((r) => ({
                proposalVersion: r.proposalVersion,
                action: r.action,
                message: r.message,
                clientName: r.clientName,
                createdAt: r.createdAt,
              })),
            },
            // PayPal ids are unique per payment, so the copy keeps only the outcome.
            payments: {
              create: p.payments.map((pay) => ({
                proposalVersion: pay.proposalVersion,
                expectedAmountCents: pay.expectedAmountCents,
                currency: pay.currency,
                status: pay.status,
                createdAt: pay.createdAt,
              })),
            },
            // Only keep payment follow-up history for unpaid proposals; paid ones
            // would otherwise re-sync the template's PayPal invoice.
            billingActions: p.payments.some((pay) => pay.status === "CAPTURED")
              ? undefined
              : {
                  create: p.billingActions.map((a) => ({
                    tool: a.tool,
                    argsJson: jsonRequired(a.argsJson),
                    rationale: a.rationale,
                    source: a.source,
                    status: a.status,
                    paypalInvoiceId: a.paypalInvoiceId,
                    subcontractorId: a.subcontractorId
                      ? (subIds.get(a.subcontractorId) ?? null)
                      : null,
                    resultJson: json(a.resultJson),
                    error: a.error,
                    decidedAt: a.decidedAt,
                    createdAt: a.createdAt,
                  })),
                },
          },
        });
        proposalIds.set(p.id, proposal.id);
      }
    }

    await prisma.deliverable.createMany({
      data: deliverables.map(({ id: _d, projectId: _p, proposalId, ...d }) => ({
        ...d,
        projectId: project.id,
        proposalId: proposalId ? (proposalIds.get(proposalId) ?? null) : null,
      })),
    });
    await prisma.activityEvent.createMany({
      data: activityEvents.map(({ id: _a, projectId: _p, metadata, ...e }) => ({
        ...e,
        metadata: json(metadata),
        projectId: project.id,
      })),
    });
  }
  return projects.length;
}

async function main() {
  const template = await prisma.user.findUnique({ where: { email: TEMPLATE_EMAIL } });
  if (!template) throw new Error(`Template account ${TEMPLATE_EMAIL} not found`);
  if (template.email === DEMO_EMAIL) throw new Error("Template and demo must differ");

  const authSubject = await ensureAuthUser(demoPassword());
  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { authSubject, name: DEMO_NAME },
    create: { email: DEMO_EMAIL, authSubject, name: DEMO_NAME },
  });

  await wipe(demo.id);
  const count = await cloneWorkspace(template.id, demo.id);
  console.log(`Demo account ${DEMO_EMAIL} reset with ${count} project(s) from ${TEMPLATE_EMAIL}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
