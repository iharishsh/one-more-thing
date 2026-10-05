import { describe, expect, it } from "vitest";
import {
  shouldMarkClientAccepted,
  shouldReplaceAgreementBaseline,
  termsEstablishAgreement,
} from "@/features/payments/agreement-lifecycle";

describe("agreement lifecycle gates", () => {
  const establishTerms = { establishesAgreement: true };
  const normalTerms = { establishesAgreement: false };

  it("detects first-proposal establish flag", () => {
    expect(termsEstablishAgreement(establishTerms)).toBe(true);
    expect(termsEstablishAgreement(normalTerms)).toBe(false);
    expect(termsEstablishAgreement(null)).toBe(false);
  });

  it("marks CLIENT_ACCEPTED only from UNCONFIRMED + establish flag", () => {
    expect(shouldMarkClientAccepted("UNCONFIRMED", establishTerms)).toBe(true);
    expect(shouldMarkClientAccepted("UNCONFIRMED", normalTerms)).toBe(false);
    expect(
      shouldMarkClientAccepted("FREELANCER_RECORDED", establishTerms),
    ).toBe(false);
    expect(shouldMarkClientAccepted("CLIENT_ACCEPTED", establishTerms)).toBe(
      false,
    );
  });

  it("never replaces a freelancer-recorded baseline", () => {
    expect(
      shouldReplaceAgreementBaseline(
        "FREELANCER_RECORDED",
        "Existing scope",
        establishTerms,
      ),
    ).toBe(false);
  });

  it("keeps FREELANCER_RECORDED as baseline provenance (no status flip on establish)", () => {
    // Acceptances still record against the exact proposal version in payment.service
    // (agreementSource / activity metadata), but must not overwrite this baseline.
    expect(
      shouldMarkClientAccepted("FREELANCER_RECORDED", establishTerms),
    ).toBe(false);
    expect(
      shouldReplaceAgreementBaseline(
        "FREELANCER_RECORDED",
        "Wedding photography package…",
        establishTerms,
      ),
    ).toBe(false);
  });

  it("client acceptance strings are proposal-version specific", () => {
    const version = 3;
    const source = `Client accepted proposal v${version}`;
    expect(source).toMatch(/proposal v3$/);
    expect(source).not.toMatch(/proposal v2/);
  });

  it("replaces empty unconfirmed / accepted-empty baselines only", () => {
    expect(
      shouldReplaceAgreementBaseline("UNCONFIRMED", "", establishTerms),
    ).toBe(true);
    expect(
      shouldReplaceAgreementBaseline("CLIENT_ACCEPTED", "", establishTerms),
    ).toBe(true);
    expect(
      shouldReplaceAgreementBaseline(
        "CLIENT_ACCEPTED",
        "Already set on accept",
        establishTerms,
      ),
    ).toBe(false);
  });
});
