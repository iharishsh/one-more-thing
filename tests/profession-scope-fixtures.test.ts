import { describe, expect, it } from "vitest";
import { parseAgreementFacts } from "@/features/changes/agreement-facts";
import { PROFESSION_SCOPES } from "./fixtures/profession-agreements";

describe("profession agreement fixtures", () => {
  it("parses confirmed scopes without inventing industry classifiers", () => {
    for (const [name, scope] of Object.entries(PROFESSION_SCOPES)) {
      const facts = parseAgreementFacts({
        scope,
        agreementStatus: "FREELANCER_RECORDED",
      });
      expect(facts.agreementConfirmed, name).toBe(true);
      expect(facts.revisionRoundsTotal, name).toBeGreaterThan(0);
      expect(facts.namedItems.length + facts.exclusionItems.length, name).toBeGreaterThan(0);
    }
  });
});
