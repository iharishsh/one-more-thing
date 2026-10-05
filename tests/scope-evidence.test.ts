import { describe, expect, it } from "vitest";
import { enforceEvidence, extractJsonObject } from "@/server/ai/evidence";
import { analysisSchema } from "@/features/changes/analysis.schema";
import { manualProvider } from "@/server/ai/manual";

describe("scope evidence", () => {
  it("requires quotes for claimed differences", () => {
    const parsed = analysisSchema.parse({
      included: [{ claim: "Logo", quote: "logo design included", reason: "ok" }],
      additional: [
        { claim: "SEO", quote: "please add SEO", reason: "new pages" },
      ],
      unclear: [
        {
          claim: "Make it pop",
          quote: "make it pop",
          reason: "vague",
          clarificationQuestion: "What do you mean?",
        },
      ],
      options: [
        { kind: "extra_price", summary: "Add SEO", suggestedPriceCents: 20000 },
      ],
    });
    expect(parsed.additional[0].quote).toBeTruthy();
  });

  it("moves unsupported claims into unclear", () => {
    const result = enforceEvidence(
      analysisSchema.parse({
        included: [],
        additional: [
          {
            claim: "Add SEO package",
            quote: "please add SEO",
            reason: "new pages",
          },
          {
            claim: "Invented work",
            quote: "totally made up quote",
            reason: "fabricated",
          },
        ],
        unclear: [],
        options: [{ kind: "extra_price", summary: "Add SEO" }],
        source: "ai",
      }),
      {
        originalScope: "Build a landing page with hero and contact form.",
        clientMessage: "Can we please add SEO pages before launch?",
      },
    );

    expect(result.additional).toHaveLength(1);
    expect(result.additional[0].claim).toContain("SEO");
    expect(result.unclear.some((u) => u.claim === "Invented work")).toBe(true);
  });

  it("extracts JSON from fenced model output", () => {
    const raw = "Sure.\n```json\n{\"ok\":true}\n```";
    expect(extractJsonObject(raw)).toEqual({ ok: true });
  });
});

describe("manual analyzer trust scenarios", () => {
  const scope = `One landing page with hero, features, and contact form.
Includes two revision rounds for visual polish of the named sections.
Does not include blog, SEO packages, or ongoing content.`;

  it("does not auto-classify polish as included", async () => {
    const result = await manualProvider.analyzeScope({
      originalScope: scope,
      clientMessage: "Can we tweak the colors and typography on the hero?",
      revisionRoundsTotal: 2,
      revisionRoundsUsed: 0,
    });
    expect(result.primaryOutcome).toBe("clarify");
    expect(result.included).toHaveLength(0);
    expect(result.additional).toHaveLength(0);
    expect(result.unclear[0]?.reviewKind).toBe("classification");
    expect(result.unclear[0]?.claim).toMatch(/colors|typography|hero/i);
  });

  it("does not auto-classify vague asks as billable", async () => {
    const result = await manualProvider.analyzeScope({
      originalScope: scope,
      clientMessage: "Can you make it pop?",
    });
    expect(result.primaryOutcome).toBe("clarify");
    expect(result.additional).toHaveLength(0);
    expect(result.options.some((o) => o.kind === "clarify")).toBe(true);
    expect(result.options.some((o) => o.kind === "extra_price")).toBe(false);
  });

  it("does not treat blog requests as additional with a price", async () => {
    const result = await manualProvider.analyzeScope({
      originalScope: scope,
      clientMessage: "Can we add blog pages before launch?",
    });
    expect(result.primaryOutcome).toBe("clarify");
    expect(result.additional).toHaveLength(0);
    expect(result.unclear[0]?.quote).toMatch(/blog/i);
    expect(result.unclear[0]?.agreementQuote).toBeTruthy();
    expect(result.options.every((o) => o.suggestedPriceCents == null)).toBe(
      true,
    );
  });
});
