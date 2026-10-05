import { describe, expect, it } from "vitest";
import { toAttentionItem } from "@/features/changes/attention";

function change(overrides: {
  included?: Array<{ claim: string }>;
  additional?: Array<{ claim: string }>;
  freelancerDecision?: { kind: "included"; summary: string; decidedAt: string };
  proposals?: Array<{
    status: string;
    acceptance: unknown;
    payments: Array<{ status: string }>;
  }>;
}) {
  return {
    id: "chg_1",
    clientMessage: "Can you tweak the hero?",
    analysisJson: {
      included: (overrides.included ?? []).map((i, idx) => ({
        id: `i${idx}`,
        claim: i.claim,
        quote: i.claim,
        evidence: "scope",
      })),
      additional: (overrides.additional ?? []).map((a, idx) => ({
        id: `a${idx}`,
        claim: a.claim,
        quote: a.claim,
        evidence: "message",
      })),
      unclear: [],
      primaryOutcome: "mixed",
      source: "manual",
      freelancerDecision: overrides.freelancerDecision,
      options: [],
    },
    project: { id: "prj_1", title: "Landing" },
    proposals: overrides.proposals ?? [],
  };
}

describe("toAttentionItem included decisions", () => {
  it("drops fully settled mark-included requests from next actions", () => {
    const item = toAttentionItem(
      change({
        included: [{ claim: "Hero spacing tweak" }],
        freelancerDecision: {
          kind: "included",
          summary: "Covered",
          decidedAt: "2026-10-04T00:00:00.000Z",
        },
      }),
    );
    expect(item).toBeNull();
  });

  it("keeps mixed included + additional requests actionable", () => {
    const item = toAttentionItem(
      change({
        included: [{ claim: "Hero spacing tweak" }],
        additional: [{ claim: "Add a blog" }],
        freelancerDecision: {
          kind: "included",
          summary: "Hero is included",
          decidedAt: "2026-10-04T00:00:00.000Z",
        },
      }),
    );
    expect(item).not.toBeNull();
    expect(item?.kind).toBe("action");
  });
});
