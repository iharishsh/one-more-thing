import { describe, expect, it } from "vitest";
import { parseAgreementFacts } from "@/features/changes/agreement-facts";
import { manualProvider } from "@/server/ai/manual";

const landingScope = `Design and ship a responsive marketing landing page with hero, features, and contact form.
Includes two revision rounds.
Does not include blog, SEO packages, or ongoing content.`;

describe("agreement facts", () => {
  it("parses named items, exclusions, and revision totals", () => {
    const facts = parseAgreementFacts({ scope: landingScope });
    expect(facts.revisionRoundsTotal).toBe(2);
    expect(facts.remainingRevisionRounds).toBe(2);
    expect(facts.exclusionItems.some((i) => /blog/i.test(i))).toBe(true);
    expect(facts.namedItems.length).toBeGreaterThan(0);
  });

  it("tracks remaining revisions when some are used", () => {
    const facts = parseAgreementFacts({
      scope: landingScope,
      revisionRoundsUsed: 2,
    });
    expect(facts.remainingRevisionRounds).toBe(0);
  });
});

describe("manual analyzer needs review only", () => {
  it("never classifies included or additional from keyword cues", async () => {
    const vague = await manualProvider.analyzeScope({
      originalScope: landingScope,
      clientMessage: "Can you make it pop?",
    });
    expect(vague.primaryOutcome).toBe("clarify");
    expect(vague.included).toHaveLength(0);
    expect(vague.additional).toHaveLength(0);
    expect(vague.unclear[0]?.claim).toMatch(/manual review/i);
    expect(vague.options.every((o) => o.suggestedPriceCents == null)).toBe(
      true,
    );

    const refine = await manualProvider.analyzeScope({
      originalScope: landingScope,
      clientMessage: "Can we tweak the colors on the hero?",
      revisionRoundsTotal: 2,
      revisionRoundsUsed: 0,
    });
    expect(refine.primaryOutcome).toBe("clarify");
    expect(refine.included).toHaveLength(0);
    expect(refine.additional).toHaveLength(0);

    const addish = await manualProvider.analyzeScope({
      originalScope: landingScope,
      clientMessage: "Can we add blog pages before launch?",
    });
    expect(addish.primaryOutcome).toBe("clarify");
    expect(addish.included).toHaveLength(0);
    expect(addish.additional).toHaveLength(0);
    expect(addish.unclear[0]?.quote).toMatch(/blog/i);
    expect(addish.unclear[0]?.agreementQuote).toBeTruthy();
  });

  it("preserves ambiguous phrasing for freelancer review", async () => {
    const result = await manualProvider.analyzeScope({
      originalScope: landingScope,
      clientMessage: "Also fix the typo. Revise the entire application.",
    });
    expect(result.primaryOutcome).toBe("clarify");
    expect(result.additional).toHaveLength(0);
    expect(result.included).toHaveLength(0);
    expect(result.unclear.length).toBeGreaterThan(0);
    expect(result.options.some((o) => o.kind === "extra_price")).toBe(false);
  });
});
