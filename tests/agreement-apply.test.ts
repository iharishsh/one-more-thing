import { describe, expect, it } from "vitest";
import { planAgreementApply } from "@/features/payments/agreement-apply";

const baseScope = "Landing page with hero and contact form.\nIncludes two revision rounds.";

describe("planAgreementApply", () => {
  it("does not bump version or burn rounds for empty included_ack confirmation", () => {
    const plan = planAgreementApply({
      currentScope: baseScope,
      currentScopeVersion: 1,
      proposalVersion: 1,
      summary: "Covered by current agreement",
      terms: {
        selectedOption: { kind: "included_ack" },
        deliverableChanges: [],
        existingWorkNote:
          "No change to the agreed deliverables; this is confirmation only.",
      },
    });
    expect(plan.noop).toBe(true);
    expect(plan.scopeChanged).toBe(false);
    expect(plan.consumeRevisionRound).toBe(false);
    expect(plan.nextScope).toBe(baseScope);
  });

  it("treats confirmation-only notes as noop even if titles were attached", () => {
    const plan = planAgreementApply({
      currentScope: baseScope,
      currentScopeVersion: 1,
      proposalVersion: 1,
      summary: "Covered by current agreement",
      terms: {
        selectedOption: { kind: "included_ack" },
        deliverableChanges: [{ title: "Tweak hero spacing" }],
        existingWorkNote:
          "No change to the agreed deliverables; this is confirmation only.",
      },
    });
    expect(plan.noop).toBe(true);
    expect(plan.scopeChanged).toBe(false);
    expect(plan.consumeRevisionRound).toBe(false);
  });

  it("does not auto-burn a revision round for included amendments without explicit intent", () => {
    const plan = planAgreementApply({
      currentScope: baseScope,
      currentScopeVersion: 1,
      proposalVersion: 2,
      summary: "Included polish without round flag",
      terms: {
        selectedOption: { kind: "included_ack" },
        deliverableChanges: [{ title: "Revise hero typography" }],
        existingWorkNote: "Using an included revision round.",
      },
    });
    expect(plan.noop).toBe(false);
    expect(plan.scopeChanged).toBe(true);
    expect(plan.consumeRevisionRound).toBe(false);
  });

  it("burns a revision round only when consumesRevisionRound is explicit", () => {
    const plan = planAgreementApply({
      currentScope: baseScope,
      currentScopeVersion: 1,
      proposalVersion: 2,
      summary: "Using a free revision round for polish",
      terms: {
        selectedOption: { kind: "included_ack" },
        deliverableChanges: [{ title: "Revise hero typography" }],
        existingWorkNote: "Using an included revision round.",
        consumesRevisionRound: true,
      },
    });
    expect(plan.noop).toBe(false);
    expect(plan.scopeChanged).toBe(true);
    expect(plan.consumeRevisionRound).toBe(true);
    expect(plan.previousScope).toBe(baseScope);
    expect(plan.previousScopeVersion).toBe(1);
    expect(plan.nextScope).toContain("Revise hero typography");
  });

  it("applies paid additions without consuming revision rounds", () => {
    const plan = planAgreementApply({
      currentScope: baseScope,
      currentScopeVersion: 1,
      proposalVersion: 1,
      summary: "Add blog section",
      terms: {
        selectedOption: { kind: "extra_price" },
        deliverableChanges: [{ title: "Blog index + 3 posts" }],
      },
    });
    expect(plan.noop).toBe(false);
    expect(plan.scopeChanged).toBe(true);
    expect(plan.consumeRevisionRound).toBe(false);
    expect(plan.previousScope).toBe(baseScope);
    expect(plan.nextScope).toContain("Blog index + 3 posts");
  });

  it("keeps recoverable previousScope snapshot fields when amending", () => {
    const plan = planAgreementApply({
      currentScope: baseScope,
      currentScopeVersion: 3,
      proposalVersion: 4,
      summary: "Paid add-on",
      terms: {
        selectedOption: { kind: "extra_price" },
        deliverableChanges: [{ title: "Dark mode" }],
      },
    });
    expect(plan.previousScopeVersion).toBe(3);
    expect(plan.previousScope).toBe(baseScope);
    expect(plan.nextScope.startsWith(baseScope)).toBe(true);
  });
});
