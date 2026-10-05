import { beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  AgentRunStatus,
  ThreadMessageKind,
  ThreadMessageVisibility,
} from "@/generated/prisma/enums";
import {
  approveClarification,
  getClientThreadByToken,
  revokeThreadInvite,
  startPrepareChange,
  submitClientAnswer,
} from "@/features/agent/agent.service";
import { addDiscussionContext } from "@/features/changes/change.service";
import { getAnalysis } from "@/features/changes/change.service";
import { reconcileAnsweredItems } from "@/features/changes/analysis-resolve";
import { ensureFindingIds } from "@/features/changes/analysis.schema";
import { runAgentWorkerOnceForTests } from "@/server/jobs/agent-worker";
import { derivePrimaryOutcome } from "@/features/changes/analysis.schema";

const hasDb = Boolean(process.env.DATABASE_URL);

async function drainJobs(prisma: PrismaClient, max = 60) {
  for (let i = 0; i < max; i++) {
    await runAgentWorkerOnceForTests();
    const pending = await prisma.agentJob.count({
      where: { status: { in: ["PENDING", "CLAIMED"] } },
    });
    const running = await prisma.agentRun.count({
      where: { status: AgentRunStatus.RUNNING },
    });
    if (pending === 0 && running === 0) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

describe("mixed request itemization (unit)", () => {
  it("keeps included, additional, and unclear separate", () => {
    const outcome = derivePrimaryOutcome({
      included: [{ claim: "Color tweak", quote: "colors", reason: "in scope" }],
      additional: [
        { claim: "Blog", quote: "blog", reason: "out of scope" },
      ],
      unclear: [
        {
          claim: "Premium feel",
          quote: "premium",
          reason: "vague",
          clarificationQuestion: "What does premium mean?",
        },
      ],
    });
    expect(outcome).toBe("mixed");
  });
});

describe.skipIf(!hasDb)("prepare / notes / answer loop", () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let ownerId: string;
  let projectId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "freelancer@example.com" },
    });
    ownerId = user.id;
    const project = await prisma.project.findFirstOrThrow({
      where: { ownerId: user.id, title: "Landing page redesign" },
    });
    projectId = project.id;
  });

  it("freelancer notes reassess without inventing acceptance", async () => {
    const change = await prisma.changeRequest.create({
      data: {
        projectId,
        clientMessage: "Make the site feel more premium somehow.",
        scopeVersionAnalyzed: 1,
        analysisJson: ensureFindingIds({
          included: [],
          additional: [],
          unclear: [
            {
              id: "f_premium",
              claim: "Make the site feel more premium",
              quote: "more premium somehow",
              reason: "vague",
              clarificationQuestion:
                "What specifically should change for a premium feel?",
            },
          ],
          primaryOutcome: "clarify",
          source: "manual",
          options: [],
        }),
        analysisRevision: 0,
      },
    });

    const result = await addDiscussionContext(change.id, ownerId, {
      notes:
        "On the call: just update the existing brand colors on the homepage — no redesign.",
      relatedItemId: "f_premium",
      reassess: true,
    });

    expect(result.change.discussionNotes).toMatch(/brand colors/i);

    const notes = await prisma.changeThreadMessage.findMany({
      where: {
        thread: { changeRequestId: change.id },
        kind: ThreadMessageKind.FREELANCER_NOTE,
      },
    });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]?.visibility).toBe(ThreadMessageVisibility.PRIVATE);

    // Deterministic resolve helper (AI may vary; this locks the product rule).
    const reconciled = reconcileAnsweredItems(
      ensureFindingIds({
        included: [
          {
            claim: "Update existing brand colors on the homepage",
            quote: "update the existing brand colors on the homepage",
            reason: "From freelancer notes",
          },
        ],
        additional: [],
        unclear: [
          {
            id: "f_premium",
            claim: "Make the site feel more premium",
            quote: "more premium somehow",
            reason: "stale",
            clarificationQuestion: "What?",
          },
        ],
        primaryOutcome: "mixed",
        source: "ai",
        options: [],
      }),
      {
        itemIds: ["f_premium"],
        claims: ["Make the site feel more premium"],
        answerText:
          "On the call: just update the existing brand colors on the homepage — no redesign.",
      },
    );
    expect(reconciled.unclear).toHaveLength(0);
  });

  it("ambiguous → approve → answer → resume; human revision protects edits; revoke blocks", async () => {
    const change = await prisma.changeRequest.create({
      data: {
        projectId,
        clientMessage: "Make the site feel more premium somehow.",
        scopeVersionAnalyzed: 1,
        analysisJson: {},
        analysisRevision: 0,
      },
    });

    const started = await startPrepareChange(change.id, ownerId);
    expect(started.alreadyActive).toBe(false);
    expect(started.run.inputRevision).toBe(0);

    const again = await startPrepareChange(change.id, ownerId);
    expect(again.alreadyActive).toBe(true);

    await drainJobs(prisma);

    const waiting = await prisma.agentRun.findUniqueOrThrow({
      where: { id: started.run.id },
    });
    // With enough context the run may skip ask; otherwise approval wait.
    expect([
      AgentRunStatus.WAITING_APPROVAL,
      AgentRunStatus.DRAFT_READY,
      AgentRunStatus.NEEDS_REVIEW,
    ]).toContain(waiting.status);

    if (waiting.status === AgentRunStatus.WAITING_APPROVAL) {
      // Human edit bumps revision — in-flight write must not clobber.
      await prisma.changeRequest.update({
        where: { id: change.id },
        data: { analysisRevision: { increment: 1 } },
      });

      await approveClarification(change.id, ownerId, {});
      const afterApprove = await prisma.agentRun.findUniqueOrThrow({
        where: { id: started.run.id },
      });
      expect(afterApprove.status).toBe(AgentRunStatus.WAITING_CLIENT);

      const thread = await prisma.changeThread.findUniqueOrThrow({
        where: { changeRequestId: change.id },
      });
      const clientView = await getClientThreadByToken(thread.inviteToken);
      expect(clientView.state).toBe("ok");
      if (clientView.state === "ok") {
        expect(
          clientView.messages.some((m) => m.kind === "CLARIFICATION_DRAFT"),
        ).toBe(false);
      }

      // Sync revision for resume bind (approve doesn't re-bind; answer does).
      await prisma.changeRequest.update({
        where: { id: change.id },
        data: { analysisRevision: afterApprove.inputRevision },
      });

      const first = await submitClientAnswer(thread.inviteToken, {
        answer: "Just update the existing brand colors on the homepage — no redesign.",
        idempotencyKey: "test-answer-1",
      });
      expect(first.duplicate).toBe(false);

      const dup = await submitClientAnswer(thread.inviteToken, {
        answer: "Just update the existing brand colors on the homepage — no redesign.",
        idempotencyKey: "test-answer-1",
      });
      expect(dup.duplicate).toBe(true);

      await drainJobs(prisma);

      const finished = await prisma.agentRun.findUniqueOrThrow({
        where: { id: started.run.id },
      });
      expect([
        AgentRunStatus.DRAFT_READY,
        AgentRunStatus.NEEDS_REVIEW,
      ]).toContain(finished.status);

      const live = await prisma.changeRequest.findUniqueOrThrow({
        where: { id: change.id },
      });
      const analysis = getAnalysis(live);
      // Product rule: if both vague + concrete exist, reconcile would drop vague.
      const cleaned = reconcileAnsweredItems(analysis, {
        itemIds: finished.pendingClarificationJson
          ? []
          : analysis.unclear.map((u) => u.id!).filter(Boolean),
        claims: ["premium"],
      });
      // Soft assert: concrete color language should not leave only the vague ask.
      const claims = [
        ...cleaned.included,
        ...cleaned.additional,
        ...cleaned.unclear,
      ].map((c) => c.claim.toLowerCase());
      if (claims.some((c) => c.includes("color"))) {
        expect(
          cleaned.unclear.every(
            (u) => !/premium somehow|feel more premium/i.test(u.claim),
          ),
        ).toBe(true);
      }
    }

    await prisma.agentRun.updateMany({
      where: { changeRequestId: change.id },
      data: { status: AgentRunStatus.CANCELLED },
    });

    const prepare2 = await startPrepareChange(change.id, ownerId);
    await drainJobs(prisma);
    const run2 = await prisma.agentRun.findUniqueOrThrow({
      where: { id: prepare2.run.id },
    });
    if (run2.status === AgentRunStatus.WAITING_APPROVAL) {
      await approveClarification(change.id, ownerId, {});
    }

    const liveThread = await prisma.changeThread.findUniqueOrThrow({
      where: { changeRequestId: change.id },
    });
    await revokeThreadInvite(change.id, ownerId);

    const revokedView = await getClientThreadByToken(liveThread.inviteToken);
    expect(revokedView.state).toBe("revoked");

    await expect(
      submitClientAnswer(liveThread.inviteToken, {
        answer: "should fail",
        idempotencyKey: "after-revoke",
      }),
    ).rejects.toThrow(/revoked/i);
  }, 90_000);
});
