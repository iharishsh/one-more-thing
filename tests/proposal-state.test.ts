import { describe, expect, it } from "vitest";
import { ProposalStatus } from "@/generated/prisma/client";
import { canAccept, canPay } from "@/features/proposals/proposal-state";

describe("proposal-state", () => {
  it("allows accept only when published", () => {
    expect(canAccept(ProposalStatus.PUBLISHED)).toBe(true);
    expect(canAccept(ProposalStatus.DRAFT)).toBe(false);
  });

  it("requires accepted status and positive price before payment", () => {
    expect(canPay(ProposalStatus.ACCEPTED, true, 15000)).toBe(true);
    expect(canPay(ProposalStatus.PUBLISHED, true, 15000)).toBe(false);
    expect(canPay(ProposalStatus.SUPERSEDED, true, 15000)).toBe(false);
    expect(canPay(ProposalStatus.ACCEPTED, true, 0)).toBe(false);
  });

  it("blocks accept after decline or changes requested", () => {
    expect(canAccept(ProposalStatus.DECLINED)).toBe(false);
    expect(canAccept(ProposalStatus.CHANGES_REQUESTED)).toBe(false);
  });
});

