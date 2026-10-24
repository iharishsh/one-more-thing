import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { summarizeWithRules } from "@/features/projects/project-summary";

const empty = {
  title: "Site",
  agreement: "",
  openRequests: 0,
  awaitingClient: 0,
  awaitingPaymentCents: 0,
  paidChangesCents: 0,
  pendingApprovals: 0,
  requests: [],
  recentActivity: [],
};

describe("project summary rules", () => {
  it("says all caught up when nothing waits", () => {
    expect(summarizeWithRules(empty)).toBe("All caught up.");
  });

  it("names each request by its real state", () => {
    const text = summarizeWithRules({
      ...empty,
      pendingApprovals: 1,
      awaitingPaymentCents: 65000,
      paidChangesCents: 90000,
      requests: [
        { request: "Swap hero photo", state: "needs your review" },
        { request: "Spanish site", state: "paid" },
        { request: "Dark mode", state: "accepted, waiting for payment" },
      ],
    });
    expect(text).toContain("Needs your review: Swap hero photo");
    expect(text).toContain("Accepted, waiting for payment: Dark mode");
    expect(text).not.toContain("review: Spanish");
    expect(text).toContain("1 payment step ready for your approval");
    expect(text).toContain("$650.00 accepted but unpaid");
    expect(text).toContain("$900.00 in paid changes");
  });

});
