import { describe, expect, it } from "vitest";
import { PaymentStatus } from "@/generated/prisma/client";
import { assertSameMoney } from "@/lib/money";

describe("money", () => {
  it("rejects capture amount mismatches", () => {
    expect(() => assertSameMoney(15000, "150.00", "USD")).not.toThrow();
    expect(() => assertSameMoney(15000, "149.00", "USD")).toThrow(
      /Amount mismatch/,
    );
  });
});

describe("payment recovery rules", () => {
  it("treats only CAPTURED as paid", () => {
    const payments: Array<{ status: PaymentStatus }> = [
      { status: PaymentStatus.CREATED },
      { status: PaymentStatus.APPROVED },
      { status: PaymentStatus.FAILED },
      { status: PaymentStatus.CAPTURED },
    ];
    const paid = payments.some((p) => p.status === PaymentStatus.CAPTURED);
    const open = payments.filter(
      (p) =>
        p.status === PaymentStatus.CREATED ||
        p.status === PaymentStatus.APPROVED,
    );
    expect(paid).toBe(true);
    expect(open).toHaveLength(2);
  });
});
