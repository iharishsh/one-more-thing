import { describe, expect, it } from "vitest";
import {
  buildPayoutArgs,
  checkPayout,
  payoutCents,
  type PayoutContext,
} from "@/features/billing/payout-guardrails";

const ctx: PayoutContext = {
  proposalId: "p1",
  priceCents: 65000,
  currency: "USD",
  paid: true,
  subcontractor: { id: "s1", paypalEmail: "ana@example.com", sharePercent: 30 },
  alreadyPaidOut: false,
};

describe("payout guardrails", () => {
  it("pays exactly the agreed share, rounded down", () => {
    expect(payoutCents(65000, 30)).toBe(19500);
    expect(payoutCents(999, 33)).toBe(329);
    expect(buildPayoutArgs(ctx, "thanks").value).toBe("195.00");
  });

  it("accepts a draft that matches current records", () => {
    const r = checkPayout(buildPayoutArgs(ctx, "thanks"), ctx);
    expect(r.ok).toBe(true);
  });

  it("blocks unpaid changes and double payouts", () => {
    const args = buildPayoutArgs(ctx, "x");
    expect(checkPayout(args, { ...ctx, paid: false }).ok).toBe(false);
    expect(checkPayout(args, { ...ctx, alreadyPaidOut: true }).ok).toBe(false);
  });

  it("rejects a draft whose email or share changed since drafting", () => {
    const args = buildPayoutArgs(ctx, "x");
    const moved = {
      ...ctx,
      subcontractor: { ...ctx.subcontractor!, paypalEmail: "new@example.com" },
    };
    expect(checkPayout(args, moved).ok).toBe(false);
    const raised = {
      ...ctx,
      subcontractor: { ...ctx.subcontractor!, sharePercent: 50 },
    };
    expect(checkPayout(args, raised).ok).toBe(false);
  });

  it("rejects a tampered amount or receiver", () => {
    const args = buildPayoutArgs(ctx, "x");
    expect(checkPayout({ ...args, value: "650.00" }, ctx).ok).toBe(false);
    expect(checkPayout({ ...args, receiver: "x@evil.test" }, ctx).ok).toBe(false);
  });

  it("blocks a removed subcontractor", () => {
    expect(
      checkPayout(buildPayoutArgs(ctx, "x"), { ...ctx, subcontractor: null }).ok,
    ).toBe(false);
  });
});
