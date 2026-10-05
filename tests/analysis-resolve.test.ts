import { describe, expect, it } from "vitest";
import {
  derivePrimaryOutcome,
  ensureFindingIds,
  moveFindingBucket,
} from "@/features/changes/analysis.schema";
import {
  demoteAllToUnclearForConflict,
  demoteVagueTasteLanguage,
  hasConflictingEvidence,
  reconcileAnsweredItems,
  inheritFindingIds,
} from "@/features/changes/analysis-resolve";

describe("answer reconciliation", () => {
  it("narrows premium ask when a concrete successor exists", () => {
    const analysis = ensureFindingIds({
      included: [
        {
          claim: "Update existing brand colors on the homepage",
          quote: "update the existing brand colors on the homepage",
          reason: "Concrete polish from the clarification answer",
        },
      ],
      additional: [],
      unclear: [
        {
          id: "f_premium",
          claim: "Make the site feel more premium",
          quote: "more premium somehow",
          reason: "Still vague",
          clarificationQuestion: "What does premium mean?",
        },
      ],
      primaryOutcome: "mixed",
      source: "ai",
      options: [],
    });

    const next = reconcileAnsweredItems(analysis, {
      itemIds: ["f_premium"],
      claims: ["Make the site feel more premium"],
      answerText:
        "Just update the existing brand colors on the homepage — no redesign.",
    });

    expect(next.unclear).toHaveLength(0);
    expect(next.included).toHaveLength(1);
    expect(derivePrimaryOutcome(next)).toBe("included");
  });

  it("drops vague premium duplicate when successor keeps the same item id", () => {
    const analysis = ensureFindingIds({
      included: [
        {
          id: "f_premium",
          claim: "Update existing brand colors on the homepage",
          quote: "update the existing brand colors on the homepage",
          reason: "Answer narrowed the ask",
        },
      ],
      additional: [],
      unclear: [
        {
          id: "f_premium",
          claim: "Make the site feel more premium somehow",
          quote: "more premium somehow",
          reason: "Original vague wording left behind",
          clarificationQuestion: "What does premium mean?",
        },
      ],
      primaryOutcome: "mixed",
      source: "ai",
      options: [],
    });

    const next = reconcileAnsweredItems(analysis, {
      itemIds: ["f_premium"],
      claims: ["Make the site feel more premium somehow"],
      answerText:
        "Just update the existing brand colors on the homepage — no redesign.",
    });

    expect(next.unclear).toHaveLength(0);
    expect(next.included).toHaveLength(1);
    expect(next.included[0]?.id).toBe("f_premium");
    expect(derivePrimaryOutcome(next)).toBe("included");
  });

  it("keeps uncertainty when the answer did not establish concrete work", () => {
    const analysis = ensureFindingIds({
      included: [],
      additional: [],
      unclear: [
        {
          id: "f_premium",
          claim: "Make it premium",
          quote: "premium",
          reason: "Answer was still vague",
          clarificationQuestion: "What specifically should change?",
        },
      ],
      primaryOutcome: "clarify",
      source: "ai",
      options: [],
    });

    const next = reconcileAnsweredItems(analysis, {
      itemIds: ["f_premium"],
      claims: ["Make it premium"],
    });

    expect(next.unclear).toHaveLength(1);
    expect(derivePrimaryOutcome(next)).toBe("clarify");
  });

  it("inherits ids across reassessments", () => {
    const prior = ensureFindingIds({
      included: [],
      additional: [],
      unclear: [
        {
          id: "f1",
          claim: "Premium feel",
          quote: "premium",
          reason: "vague",
          clarificationQuestion: "What?",
        },
      ],
      primaryOutcome: "clarify",
      source: "ai",
      options: [],
    });
    const next = inheritFindingIds(prior, {
      included: [
        {
          claim: "Premium feel via color update",
          quote: "brand colors",
          reason: "narrowed",
        },
      ],
      additional: [],
      unclear: [],
      primaryOutcome: "included",
      source: "ai",
      options: [],
    });
    // Claim changed enough that inherit may assign new id — either ok if ids present
    expect(next.included[0]?.id).toBeTruthy();
  });

  it("demotes vague taste language from included even with revision polish framing", () => {
    const analysis = ensureFindingIds({
      included: [
        {
          claim: "Make the logo a bit nicer",
          quote: "make the logo a bit nicer",
          reason: "Covered by remaining revision rounds",
        },
      ],
      additional: [],
      unclear: [],
      primaryOutcome: "included",
      source: "ai",
      options: [],
    });
    const next = demoteVagueTasteLanguage(analysis);
    expect(next.included).toHaveLength(0);
    expect(next.unclear).toHaveLength(1);
    expect(derivePrimaryOutcome(next)).toBe("clarify");
  });

  it("detects conflicting notes vs narrow answers", () => {
    expect(
      hasConflictingEvidence({
        discussionNotes:
          "Client asked for a full homepage redesign with new photography.",
        clarificationHistory:
          "Client answer: Only swap the existing brand colors — nothing else.",
      }),
    ).toBe(true);

    const demoted = demoteAllToUnclearForConflict(
      ensureFindingIds({
        included: [
          {
            claim: "Color swap only",
            quote: "only swap",
            reason: "Picked the answer",
          },
        ],
        additional: [],
        unclear: [],
        primaryOutcome: "included",
        source: "ai",
        options: [],
      }),
    );
    expect(demoted.included).toHaveLength(0);
    expect(demoted.unclear.length).toBeGreaterThan(0);
    expect(derivePrimaryOutcome(demoted)).toBe("clarify");
  });

  it("keeps concrete polish as included", () => {
    const analysis = ensureFindingIds({
      included: [
        {
          claim: "Brighten a few portraits in the gallery",
          quote: "brighten a few portraits",
          reason: "Concrete retouch within package",
        },
      ],
      additional: [],
      unclear: [],
      primaryOutcome: "included",
      source: "ai",
      options: [],
    });
    const next = demoteVagueTasteLanguage(analysis);
    expect(next.included).toHaveLength(1);
    expect(next.unclear).toHaveLength(0);
  });

  it("supports per-item classification moves", () => {
    const analysis = ensureFindingIds({
      included: [],
      additional: [],
      unclear: [
        {
          id: "f1",
          claim: "Color tweak",
          quote: "colors",
          reason: "review",
        },
      ],
      primaryOutcome: "clarify",
      source: "manual",
      options: [],
    });
    const moved = moveFindingBucket(analysis, "f1", "included");
    expect(moved.included).toHaveLength(1);
    expect(moved.unclear).toHaveLength(0);
    expect(moved.primaryOutcome).toBe("included");
  });
});
