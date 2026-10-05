import { describe, expect, it } from "vitest";
import { analysisSchema } from "@/features/changes/analysis.schema";
import { planAgreementApply } from "@/features/payments/agreement-apply";
import { quoteLineSchema } from "@/features/products/product.schema";
import { publishProposalSchema } from "@/features/proposals/proposal.schema";
import { assertSameMoney } from "@/lib/money";

describe("commercial and analysis boundaries", () => {
  it("rejects javascript: product buy URLs", () => {
    const bad = quoteLineSchema.safeParse({
      kind: "product",
      label: "Print pack",
      amountCents: 1000,
      product: {
        id: "p1",
        title: "Print pack",
        buyUrl: "javascript:alert(1)",
        retrievedAt: new Date().toISOString(),
      },
    });
    expect(bad.success).toBe(false);

    const good = quoteLineSchema.safeParse({
      kind: "product",
      label: "Print pack",
      amountCents: 1000,
      product: {
        id: "p1",
        title: "Print pack",
        buyUrl: "https://example.com/prints",
        retrievedAt: new Date().toISOString(),
      },
    });
    expect(good.success).toBe(true);
  });

  it("requires explicit priceCents on publish — does not invent from free text", () => {
    const parsed = publishProposalSchema.safeParse({
      summary: "Extra retouching for $500",
      priceCents: 0,
      currency: "USD",
      optionKind: "extra_price",
      optionSummary: "Extra retouching",
      deliverableTitles: ["Portrait retouching"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.priceCents).toBe(0);
      expect(parsed.data).not.toHaveProperty("inventedPrice");
    }
  });

  it("strips unknown keys from analysis payloads", () => {
    const parsed = analysisSchema.parse({
      included: [],
      additional: [],
      unclear: [
        {
          claim: "retouch",
          quote: "retouch",
          reason: "unclear",
        },
      ],
      primaryOutcome: "clarify",
      source: "manual",
      options: [],
      adminOverride: true,
      publishNow: true,
      priceCents: 99999,
    });
    expect(parsed).not.toHaveProperty("adminOverride");
    expect(parsed).not.toHaveProperty("publishNow");
    expect(parsed).not.toHaveProperty("priceCents");
  });

  it("rejects capture amount mismatches", () => {
    expect(() => assertSameMoney(1000, "9.99", "USD")).toThrow(/mismatch|amount/i);
  });

  it("treats confirmation-only included_ack as a noop even if consumesRevisionRound is set", () => {
    const plan = planAgreementApply({
      currentScope: "Landing page. Includes two revision rounds.",
      currentScopeVersion: 1,
      proposalVersion: 1,
      summary: "Confirm covered",
      terms: {
        selectedOption: { kind: "included_ack" },
        deliverableChanges: [],
        existingWorkNote:
          "No change to the agreed deliverables; this is confirmation only.",
        consumesRevisionRound: true,
      },
    });
    expect(plan.noop).toBe(true);
    expect(plan.scopeChanged).toBe(false);
    expect(plan.consumeRevisionRound).toBe(false);
  });

  it("establishes a clean baseline when first proposal lands on an empty agreement", () => {
    const plan = planAgreementApply({
      currentScope: "",
      currentScopeVersion: 1,
      proposalVersion: 1,
      summary: "Mobile app MVP",
      establishesAgreement: true,
      terms: {
        selectedOption: { kind: "extra_price" },
        deliverableChanges: [{ title: "iOS and Android MVP" }],
        deliveryNote: "8 weeks from acceptance",
      },
    });
    expect(plan.noop).toBe(false);
    expect(plan.nextScope).toContain("Mobile app MVP");
    expect(plan.nextScope).toContain("iOS and Android MVP");
    expect(plan.nextScope).not.toMatch(/PROVISIONAL|Do not classify/i);
  });
});
