import "server-only";

import { PaymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { formatUsd } from "@/lib/money";

type ProjectFacts = {
  title: string;
  agreement: string;
  openRequests: number;
  awaitingClient: number;
  awaitingPaymentCents: number;
  paidChangesCents: number;
  pendingApprovals: number;
  /** Each request with its real state, so the model never has to guess. */
  requests: Array<{ request: string; state: string }>;
  recentActivity: string[];
};

async function gatherFacts(projectId: string): Promise<ProjectFacts | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      changeRequests: {
        include: {
          proposals: {
            orderBy: { version: "desc" },
            take: 1,
            include: {
              payments: true,
              billingActions: { where: { status: "PROPOSED" } },
            },
          },
        },
      },
      activityEvents: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
  if (!project) return null;

  const facts: ProjectFacts = {
    title: project.title,
    agreement: project.currentScope.slice(0, 600),
    openRequests: 0,
    awaitingClient: 0,
    awaitingPaymentCents: 0,
    paidChangesCents: 0,
    pendingApprovals: 0,
    requests: [],
    recentActivity: project.activityEvents.map((e) => e.message),
  };
  const titleOf = (change: { clientMessage: string }, summary?: string) =>
    (summary || change.clientMessage).replace(/\s+/g, " ").slice(0, 80);
  for (const change of project.changeRequests) {
    const latest = change.proposals[0];
    if (!latest) {
      facts.openRequests += 1;
      facts.requests.push({ request: titleOf(change), state: "needs your review" });
      continue;
    }
    const paid = latest.payments.some(
      (p) => p.status === PaymentStatus.CAPTURED,
    );
    let state = latest.status.toLowerCase();
    if (paid) {
      facts.paidChangesCents += latest.priceCents;
      state = "paid";
    } else if (latest.status === "ACCEPTED") {
      facts.awaitingPaymentCents += latest.priceCents;
      state = latest.priceCents ? "accepted, waiting for payment" : "accepted, no charge";
    } else if (latest.status === "PUBLISHED") {
      facts.awaitingClient += 1;
      state = "waiting for the client to accept";
    }
    facts.requests.push({ request: titleOf(change, latest.summary), state });
    facts.pendingApprovals += latest.billingActions.length;
  }
  return facts;
}

/** Deterministic line — used without a hosted model and when it fails. */
export function summarizeWithRules(f: ProjectFacts): string {
  const byState = new Map<string, string[]>();
  for (const r of f.requests) {
    byState.set(r.state, [...(byState.get(r.state) ?? []), r.request]);
  }
  const parts: string[] = [];
  const list = (state: string, label: string) => {
    const items = byState.get(state);
    if (items?.length) parts.push(`${label}: ${items.join("; ")}`);
  };
  list("needs your review", "Needs your review");
  list("accepted, waiting for payment", "Accepted, waiting for payment");
  list("waiting for the client to accept", "Waiting for the client");
  if (f.pendingApprovals) {
    parts.push(
      `${f.pendingApprovals} payment step${f.pendingApprovals > 1 ? "s" : ""} ready for your approval`,
    );
  }
  if (!parts.length && f.requests.length === 0) {
    // Old projects without request detail fall back to counts.
    if (f.openRequests) parts.push(`${f.openRequests} request(s) to review`);
    if (f.awaitingClient) parts.push(`${f.awaitingClient} proposal(s) waiting on the client`);
  }
  const unpaid = f.awaitingPaymentCents
    ? ` ${formatUsd(f.awaitingPaymentCents)} accepted but unpaid.`
    : "";
  const paid = f.paidChangesCents
    ? ` ${formatUsd(f.paidChangesCents)} in paid changes so far.`
    : "";
  return parts.length
    ? `${parts.join(". ")}.${unpaid}${paid}`
    : `All caught up.${paid}`;
}

/** The project's status line, computed from current records on every render so
 * it can never go stale (deletes, payments and webhooks all change it). */
export async function getProjectStatusLine(projectId: string) {
  const facts = await gatherFacts(projectId);
  return facts ? summarizeWithRules(facts) : null;
}

export async function refreshProjectSummary(projectId: string) {
  const facts = await gatherFacts(projectId);
  if (!facts) return;

  // Built from the AI-classified requests and payment records. A model rewrite
  // was tried and dropped: it misstated request states too often.
  const summary = summarizeWithRules(facts);

  await prisma.project.update({
    where: { id: projectId },
    data: { aiSummary: summary, aiSummaryAt: new Date() },
  });
}

const inFlight = new Set<string>();

/** Fire-and-forget refresh after something changed. Never blocks or throws. */
export function refreshProjectSummarySoon(projectId: string) {
  if (inFlight.has(projectId)) return;
  inFlight.add(projectId);
  setTimeout(() => {
    refreshProjectSummary(projectId)
      .catch((error) => console.warn("[project-summary]", error))
      .finally(() => inFlight.delete(projectId));
  }, 0);
}

/** Fills in summaries for projects that have never had one (e.g. created before this feature). */
export async function backfillProjectSummaries(limit = 3) {
  const missing = await prisma.project.findMany({
    where: { aiSummary: null, status: "ACTIVE" },
    select: { id: true },
    take: limit,
  });
  for (const project of missing) await refreshProjectSummary(project.id);
}
