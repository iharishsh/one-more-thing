import { describe, expect, it } from "vitest";
import { parseAgreementFacts } from "@/features/changes/agreement-facts";
import {
  buildProvisionalScope,
  enforceUnconfirmedAgreement,
  isAgreementUnconfirmed,
  isProvisionalAgreement,
  PROVISIONAL_AGREEMENT_MARKER,
} from "@/features/changes/provisional-agreement";

describe("unconfirmed agreement boundary", () => {
  it("treats structured UNCONFIRMED status as no baseline", () => {
    expect(
      isAgreementUnconfirmed({
        agreementStatus: "UNCONFIRMED",
        currentScope: "",
      }),
    ).toBe(true);
    expect(
      isAgreementUnconfirmed({
        agreementStatus: "FREELANCER_RECORDED",
        currentScope: "Landing page with two revisions",
      }),
    ).toBe(false);

    const facts = parseAgreementFacts({
      scope: "",
      agreementStatus: "UNCONFIRMED",
    });
    expect(facts.agreementConfirmed).toBe(false);
    expect(facts.namedItems).toEqual([]);
    expect(facts.revisionRoundsTotal).toBeNull();
  });

  it("does not embed workflow instructions in new intake scope text", () => {
    const scope = buildProvisionalScope({
      clientMessage: "Need a native iOS and Android app with push notifications",
      discussionNotes: "They mentioned Stripe later",
    });
    expect(scope).toBe(
      "Need a native iOS and Android app with push notifications",
    );
    expect(scope).not.toContain(PROVISIONAL_AGREEMENT_MARKER);
    expect(scope).not.toMatch(/do not classify|draft intake only/i);
  });

  it("still detects legacy marker text for unmigrated rows", () => {
    const legacy = `${PROVISIONAL_AGREEMENT_MARKER}\n\nClient request`;
    expect(isProvisionalAgreement(legacy)).toBe(true);
    expect(
      isAgreementUnconfirmed({ agreementStatus: null, currentScope: legacy }),
    ).toBe(true);
  });

  it("demotes included/additional model output when unconfirmed", () => {
    const enforced = enforceUnconfirmedAgreement(true, {
      included: [
        {
          id: "i1",
          claim: "native app",
          quote: "native iOS",
          reason: "echoed intake",
        },
      ],
      additional: [],
      unclear: [],
      primaryOutcome: "included",
      source: "ai",
      options: [],
    });

    expect(enforced.included).toHaveLength(0);
    expect(enforced.additional).toHaveLength(0);
    expect(enforced.unclear.length).toBeGreaterThan(0);
    expect(enforced.primaryOutcome).toBe("clarify");
    expect(enforced.unclear[0]?.reason).toMatch(/no confirmed agreement|first proposal/i);
  });

  it("leaves confirmed agreements unchanged", () => {
    const analysis = {
      included: [
        {
          id: "i1",
          claim: "hero polish",
          quote: "hero",
          reason: "covered",
        },
      ],
      additional: [],
      unclear: [],
      primaryOutcome: "included" as const,
      source: "ai" as const,
      options: [],
    };
    expect(enforceUnconfirmedAgreement(false, analysis)).toEqual(analysis);
    expect(
      parseAgreementFacts({
        scope: "Landing page with hero and form.\nIncludes two revision rounds.",
        agreementStatus: "FREELANCER_RECORDED",
      }).agreementConfirmed,
    ).toBe(true);
  });
});
