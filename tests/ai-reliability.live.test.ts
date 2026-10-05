import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  runAnalysisMeasured,
  type AnalysisMeasurement,
} from "@/server/ai/provider";
import type { AnalysisResult } from "@/features/changes/analysis.schema";
import {
  BLOG_CMS_DARK_MESSAGE,
  FULL_SITE_SCOPE,
  LANDING_SCOPE,
} from "./fixtures/agreements";
import {
  CONSULTANT_SCOPE,
  DESIGNER_SCOPE,
  DEVELOPER_SCOPE,
  PHOTOGRAPHER_SCOPE,
} from "./fixtures/profession-agreements";

const runLive =
  process.env.RUN_AI_RELIABILITY === "1" &&
  (process.env.AI_PROVIDER === "hosted" ||
    process.env.AI_PROVIDER === "ollama");

type Expectation =
  | { primary: "included" | "additional" | "clarify" | "mixed" }
  | { unconfirmedAllUnclear: true }
  | {
      /** Clarify first; with answer must resolve without duplicate vague item. */
      clarifyThenResolve: {
        answer: string;
        expectPrimary: "included" | "additional";
      };
    };

type Case = {
  id: string;
  scope: string;
  message: string;
  agreementConfirmed: boolean;
  discussionNotes?: string;
  clarificationHistory?: string;
  expect: Expectation;
};

const CASES: Case[] = [
  // Photography
  {
    id: "photo-included-brighten",
    scope: PHOTOGRAPHER_SCOPE,
    message:
      "Can you just brighten a few portraits in the gallery before we share with family?",
    agreementConfirmed: true,
    expect: { primary: "included" },
  },
  {
    id: "photo-additional-prints",
    scope: PHOTOGRAPHER_SCOPE,
    message:
      "Also need 50 large prints and commercial usage rights for our ads please.",
    agreementConfirmed: true,
    expect: { primary: "additional" },
  },
  {
    id: "photo-additional-drone",
    scope: PHOTOGRAPHER_SCOPE,
    message: "Can we add a drone flyover of the venue too?",
    agreementConfirmed: true,
    expect: { primary: "additional" },
  },
  // Landing vs full site contrast
  {
    id: "landing-blog-additional",
    scope: LANDING_SCOPE,
    message: BLOG_CMS_DARK_MESSAGE,
    agreementConfirmed: true,
    expect: { primary: "additional" },
  },
  {
    id: "fullsite-blog-covered",
    scope: FULL_SITE_SCOPE,
    message: BLOG_CMS_DARK_MESSAGE,
    agreementConfirmed: true,
    expect: { primary: "included" },
  },
  {
    id: "landing-seo-additional",
    scope: LANDING_SCOPE,
    message: "Please add three SEO landing pages before launch.",
    agreementConfirmed: true,
    expect: { primary: "additional" },
  },
  // Clarification / ambiguity
  {
    id: "clarify-premium",
    scope: LANDING_SCOPE,
    message: "Make the site feel more premium somehow.",
    agreementConfirmed: true,
    expect: { primary: "clarify" },
  },
  {
    id: "clarify-premium-resolve-no-dup",
    scope: LANDING_SCOPE,
    message: "Make the site feel more premium somehow.",
    agreementConfirmed: true,
    expect: {
      clarifyThenResolve: {
        answer:
          "Just update the existing brand colors on the homepage — no redesign, no new pages.",
        expectPrimary: "included",
      },
    },
  },
  {
    id: "clarify-premium-repeat",
    scope: LANDING_SCOPE,
    message: "Make the site feel more premium somehow.",
    agreementConfirmed: true,
    expect: { primary: "clarify" },
  },
  {
    id: "clarify-nicer",
    scope: DESIGNER_SCOPE,
    message: "Can you make the logo a bit nicer?",
    agreementConfirmed: true,
    expect: { primary: "clarify" },
  },
  // Mixed / multi-ask
  {
    id: "mixed-blog-and-premium",
    scope: LANDING_SCOPE,
    message:
      "Add a blog with CMS, and also make the homepage feel more premium somehow.",
    agreementConfirmed: true,
    expect: { primary: "mixed" },
  },
  {
    id: "mixed-dev-mobile-and-tweak",
    scope: DEVELOPER_SCOPE,
    message:
      "We also need a native iOS app, and can you tweak the dashboard spacing a little?",
    agreementConfirmed: true,
    expect: { primary: "mixed" },
  },
  // Conflicting notes
  {
    id: "conflict-notes-vs-answer",
    scope: LANDING_SCOPE,
    message: "Make it feel more premium.",
    agreementConfirmed: true,
    discussionNotes:
      "CONFLICTING CONTEXT: On a call the client asked for a full homepage redesign with new photography (large new deliverable).",
    clarificationHistory:
      "Question to client: What does premium mean?\nClient answer: Only swap the existing brand colors on the hero — nothing else.\nFreelancer note (not acceptance): This answer conflicts with the earlier redesign ask — do not assume which one wins.",
    expect: { primary: "clarify" },
  },
  {
    id: "notes-resolve-premium",
    scope: LANDING_SCOPE,
    message: "Make it feel more premium.",
    agreementConfirmed: true,
    discussionNotes:
      "Client clarified on call: only update existing brand colors on the homepage hero.",
    expect: { primary: "included" },
  },
  // Other professions
  {
    id: "designer-additional-packaging",
    scope: DESIGNER_SCOPE,
    message: "We also need packaging design for the product box.",
    agreementConfirmed: true,
    expect: { primary: "additional" },
  },
  {
    id: "consultant-additional-impl",
    scope: CONSULTANT_SCOPE,
    message: "Can you also implement the recommendations in our Notion workspace?",
    agreementConfirmed: true,
    expect: { primary: "additional" },
  },
  {
    id: "dev-included-dashboard-tweak",
    scope: DEVELOPER_SCOPE,
    message:
      "Can you adjust the dashboard card spacing slightly before staging review?",
    agreementConfirmed: true,
    expect: { primary: "included" },
  },
  {
    id: "dev-additional-mobile",
    scope: DEVELOPER_SCOPE,
    message: "We need a native iOS and Android app with push notifications.",
    agreementConfirmed: true,
    expect: { primary: "additional" },
  },
  // Unconfirmed / no baseline
  {
    id: "unconfirmed-no-baseline",
    scope: "",
    message: "Need a native iOS and Android app with push notifications.",
    agreementConfirmed: false,
    expect: { unconfirmedAllUnclear: true },
  },
  {
    id: "unconfirmed-with-draft-scope",
    scope: "Draft notes about a marketing site — not yet agreed.",
    message: "Please add a blog and dark mode.",
    agreementConfirmed: false,
    expect: { unconfirmedAllUnclear: true },
  },
];

function hasUsableFindings(result: AnalysisResult) {
  return (
    result.included.length +
      result.additional.length +
      result.unclear.length >
    0
  );
}

function semanticCorrect(
  c: Case,
  result: AnalysisResult,
  phase: "primary" | "resolved" = "primary",
): boolean {
  if ("unconfirmedAllUnclear" in c.expect) {
    return (
      result.included.length === 0 &&
      result.additional.length === 0 &&
      result.unclear.length > 0
    );
  }
  if ("clarifyThenResolve" in c.expect) {
    if (phase === "primary") {
      return (
        result.primaryOutcome === "clarify" || result.unclear.length > 0
      );
    }
    const want = c.expect.clarifyThenResolve.expectPrimary;
    if (want === "included") {
      return (
        (result.primaryOutcome === "included" ||
          (result.included.length > 0 && result.additional.length === 0)) &&
        result.unclear.length === 0
      );
    }
    return (
      (result.primaryOutcome === "additional" ||
        result.additional.length > 0) &&
      result.unclear.length === 0
    );
  }
  if (c.expect.primary === "included") {
    return (
      result.primaryOutcome === "included" ||
      (result.included.length > 0 && result.additional.length === 0)
    );
  }
  if (c.expect.primary === "additional") {
    return (
      result.primaryOutcome === "additional" || result.additional.length > 0
    );
  }
  if (c.expect.primary === "clarify") {
    return (
      result.primaryOutcome === "clarify" || result.unclear.length > 0
    );
  }
  if (c.expect.primary === "mixed") {
    return (
      result.primaryOutcome === "mixed" ||
      (result.unclear.length > 0 &&
        (result.included.length > 0 || result.additional.length > 0)) ||
      (result.included.length > 0 && result.additional.length > 0)
    );
  }
  return false;
}

function countByKind(kinds: string[]) {
  const out: Record<string, number> = {};
  for (const k of kinds) out[k] = (out[k] ?? 0) + 1;
  return out;
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[idx] ?? 0;
}

async function runCase(c: Case) {
  const facts = {
    namedItems: [] as string[],
    exclusionItems: [] as string[],
    revisionRoundsTotal: null as number | null,
    revisionRoundsUsed: 0,
    remainingRevisionRounds: null as number | null,
    agreementConfirmed: c.agreementConfirmed,
  };

  if ("clarifyThenResolve" in c.expect) {
    const first = await runAnalysisMeasured({
      originalScope: c.scope,
      clientMessage: c.message,
      agreementFacts: facts,
    });
    const priorUnclear = first.result.unclear;
    const history = [
      priorUnclear[0]?.clarificationQuestion
        ? `Question to client: ${priorUnclear[0].clarificationQuestion}`
        : "Question to client: What specifically should change?",
      `Client answer: ${c.expect.clarifyThenResolve.answer}`,
    ].join("\n");

    const second = await runAnalysisMeasured({
      originalScope: c.scope,
      clientMessage: c.message,
      clarificationHistory: history,
      priorItems: [
        ...first.result.included.map((i) => ({
          id: i.id,
          bucket: "included" as const,
          claim: i.claim,
          quote: i.quote,
        })),
        ...first.result.additional.map((i) => ({
          id: i.id,
          bucket: "additional" as const,
          claim: i.claim,
          quote: i.quote,
        })),
        ...first.result.unclear.map((i) => ({
          id: i.id,
          bucket: "unclear" as const,
          claim: i.claim,
          quote: i.quote,
          clarificationQuestion: i.clarificationQuestion,
        })),
      ],
      agreementFacts: facts,
    });

    // Same post-processing as change.service analyzeChangeInput.
    const { inheritFindingIds, reconcileAnsweredItems } = await import(
      "@/features/changes/analysis-resolve"
    );
    const withIds = inheritFindingIds(first.result, second.result);
    const reconciled = reconcileAnsweredItems(withIds, {
      itemIds: priorUnclear.map((i) => i.id).filter(Boolean) as string[],
      claims: priorUnclear.map((i) => i.claim),
      answerText: c.expect.clarifyThenResolve.answer,
    });

    const totalMs = first.totalMs + second.totalMs;
    const attempts = [...first.attempts, ...second.attempts];
    const attemptFailureKinds = [
      ...first.attemptFailureKinds,
      ...second.attemptFailureKinds,
    ];
    const firstAttemptValid = first.firstAttemptValid;
    const finalValidOutput =
      first.finalValidOutput &&
      second.finalValidOutput &&
      hasUsableFindings(reconciled);
    const safeFallback = first.safeFallback || second.safeFallback;
    const firstPassOk = semanticCorrect(c, first.result, "primary");
    const resolvedOk =
      finalValidOutput &&
      !safeFallback &&
      semanticCorrect(c, reconciled, "resolved");
    const noDuplicateVague =
      reconciled.unclear.filter((u) =>
        /premium/i.test(`${u.claim} ${u.quote}`),
      ).length === 0;

    return {
      id: c.id,
      totalMs,
      firstAttemptValid,
      finalValidOutput,
      correctUsableAi: Boolean(resolvedOk && noDuplicateVague),
      safeFallback,
      incorrectAi:
        finalValidOutput &&
        !safeFallback &&
        !(resolvedOk && noDuplicateVague),
      primaryOutcome: reconciled.primaryOutcome,
      source: second.result.source,
      sourceDetail: second.result.sourceDetail,
      attemptFailureKinds,
      failureKindCounts: countByKind(attemptFailureKinds),
      attempts,
      clarifyFirstOk: firstPassOk,
      noDuplicateVague,
      buckets: {
        included: reconciled.included.length,
        additional: reconciled.additional.length,
        unclear: reconciled.unclear.length,
      },
    };
  }

  const m: AnalysisMeasurement = await runAnalysisMeasured({
    originalScope: c.scope,
    clientMessage: c.message,
    discussionNotes: c.discussionNotes,
    clarificationHistory: c.clarificationHistory,
    agreementFacts: facts,
  });

  const correctUsableAi =
    m.finalValidOutput &&
    !m.safeFallback &&
    semanticCorrect(c, m.result);
  const incorrectAi =
    m.finalValidOutput && !m.safeFallback && !semanticCorrect(c, m.result);

  return {
    id: c.id,
    totalMs: m.totalMs,
    firstAttemptValid: m.firstAttemptValid,
    finalValidOutput: m.finalValidOutput,
    correctUsableAi,
    safeFallback: m.safeFallback,
    incorrectAi,
    primaryOutcome: m.result.primaryOutcome,
    source: m.result.source,
    sourceDetail: m.result.sourceDetail,
    attemptFailureKinds: m.attemptFailureKinds,
    failureKindCounts: countByKind(m.attemptFailureKinds),
    attempts: m.attempts,
    buckets: {
      included: m.result.included.length,
      additional: m.result.additional.length,
      unclear: m.result.unclear.length,
    },
  };
}

describe("AI reliability (live)", () => {
  it.skipIf(!runLive)(
    "reports five measures + failure kinds across ~20 cases",
    async () => {
      const rows = [];
      for (const [index, c] of CASES.entries()) {
        if (index > 0) {
          // Space requests so TPM budgets can recover between cases.
          await new Promise((r) => setTimeout(r, 12_000));
        }
        // Extra pause before multi-call clarification cases.
        if ("clarifyThenResolve" in c.expect) {
          await new Promise((r) => setTimeout(r, 8_000));
        }
        const row = await runCase(c);
        rows.push(row);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(row));
      }

      const n = rows.length;
      const latencies = rows.map((r) => r.totalMs).sort((a, b) => a - b);
      const allFailureKinds = rows.flatMap((r) => r.attemptFailureKinds);
      const summary = {
        provider: process.env.AI_PROVIDER,
        chain: process.env.HOSTED_AI_CHAIN ?? null,
        model:
          process.env.GROQ_MODEL ||
          process.env.OPENROUTER_MODEL ||
          process.env.OLLAMA_MODEL ||
          null,
        cases: n,
        note: "Smoke→expanded harness. Safe fallback ≠ correct usable AI. Latency is whole request incl. retries. p95 unstable at this N.",
        measures: {
          firstAttemptValidRate:
            rows.filter((r) => r.firstAttemptValid).length / n,
          finalValidOutputRate:
            rows.filter((r) => r.finalValidOutput).length / n,
          correctUsableAiRate:
            rows.filter((r) => r.correctUsableAi).length / n,
          safeFallbackRate: rows.filter((r) => r.safeFallback).length / n,
          incorrectAiRate: rows.filter((r) => r.incorrectAi).length / n,
        },
        failureKindsObserved: countByKind(allFailureKinds),
        failureKindsNote:
          "rate_limit and schema_mismatch are counted separately from attempt records; sequence after rate-limit pressure is not proof of causation for later schema failures.",
        latencyMsWholeRequest: {
          min: latencies[0] ?? 0,
          p50: percentile(latencies, 0.5),
          p95: percentile(latencies, 0.95),
          max: latencies[n - 1] ?? 0,
          samples: n,
        },
        jsonModeNote:
          "response_format json_object is transport-only; Zod analysisSchema remains required.",
      };

      const outPath = path.resolve("tmp-ai-reliability-summary.json");
      writeFileSync(
        outPath,
        JSON.stringify({ summary, rows }, null, 2),
        "utf8",
      );
      // eslint-disable-next-line no-console
      console.log(`Wrote ${outPath}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(summary, null, 2));

      expect(n).toBe(CASES.length);
      expect(CASES.length).toBeGreaterThanOrEqual(18);
      // Measurement harness always completes — rates are the product signal.
      expect(summary.measures.correctUsableAiRate).toBeGreaterThanOrEqual(0);

      const premiumResolve = rows.find(
        (r) => r.id === "clarify-premium-resolve-no-dup",
      );
      if (premiumResolve && premiumResolve.finalValidOutput) {
        expect(premiumResolve.noDuplicateVague).toBe(true);
      }
    },
    900_000,
  );
});
