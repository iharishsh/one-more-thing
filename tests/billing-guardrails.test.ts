import { describe, expect, it } from "vitest";
import {
  checkProposedCall,
  planWithRules,
  type BillingState,
} from "@/features/billing/billing-guardrails";

const base: BillingState = {
  proposalId: "p1",
  summary: "Add dark mode",
  priceCents: 25000,
  currency: "USD",
  clientEmail: "client@example.com",
  invoiceId: null,
  invoiceStatus: null,
  remindersSent: 0,
  hoursSinceLastEmail: null,
};

const invoiceArgs = (value: string, email = "client@example.com") => ({
  currency_code: "USD",
  allow_tip: true,
  primary_recipients: [{ billing_info: { email_address: email } }],
  items: [{ name: "Dark mode", quantity: "1", unit_amount: { currency_code: "USD", value } }],
});

describe("billing guardrails", () => {
  it("accepts an invoice for exactly the accepted price and strips tip", () => {
    const r = checkProposedCall({ tool: "create_invoice", args: invoiceArgs("250.00") }, base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.allow_tip).toBeUndefined();
      expect(r.args.reference).toBe("omt:p1");
    }
  });

  it("strips an invented invoicer identity", () => {
    const r = checkProposedCall(
      {
        tool: "create_invoice",
        args: { ...invoiceArgs("250.00"), invoicer_given_name: "John", invoicer_email_address: "freelancer@example.com", invoice_number: "1" },
      },
      base,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.args).some((k) => k.startsWith("invoicer_"))).toBe(false);
      expect(r.args.invoice_number).toBeUndefined();
    }
  });

  it("uses the app's business name, not the model's", () => {
    const r = checkProposedCall(
      { tool: "create_invoice", args: { ...invoiceArgs("250.00"), invoicer_business_name: "Made Up LLC" } },
      { ...base, businessName: "Shanks Studio" },
    );
    expect(r.ok && r.args.invoicer_business_name).toBe("Shanks Studio");
  });

  it("swaps the email placeholder for the real client email", () => {
    const r = checkProposedCall(
      { tool: "create_invoice", args: invoiceArgs("250.00", "client@on-file.invalid") },
      base,
    );
    expect(r.ok && JSON.stringify(r.args.primary_recipients)).toContain("client@example.com");
  });

  it("rejects a model-chosen price", () => {
    const r = checkProposedCall({ tool: "create_invoice", args: invoiceArgs("300.00") }, base);
    expect(r.ok).toBe(false);
  });

  it("rejects a different recipient", () => {
    const r = checkProposedCall(
      { tool: "create_invoice", args: invoiceArgs("250.00", "attacker@example.com") },
      base,
    );
    expect(r.ok).toBe(false);
  });

  it("only sends this proposal's draft invoice", () => {
    const state = { ...base, invoiceId: "INV2-AAAA", invoiceStatus: "DRAFT" };
    expect(checkProposedCall({ tool: "send_invoice", args: { invoice_id: "INV2-BBBB" } }, state).ok).toBe(false);
    expect(checkProposedCall({ tool: "send_invoice", args: { invoice_id: "INV2-AAAA" } }, state).ok).toBe(true);
  });

  it("blocks tools outside the allowlist", () => {
    expect(checkProposedCall({ tool: "create_refund", args: {} }, base).ok).toBe(false);
  });

  it("rules planner walks create → send → wait → remind", () => {
    expect(planWithRules(base)?.tool).toBe("create_invoice");
    const draft = { ...base, invoiceId: "INV2-AAAA", invoiceStatus: "DRAFT" };
    expect(planWithRules(draft)?.tool).toBe("send_invoice");
    const sent = { ...draft, invoiceStatus: "UNPAID", hoursSinceLastEmail: 2 };
    expect(planWithRules(sent)).toBeNull();
    expect(planWithRules({ ...sent, hoursSinceLastEmail: 80 })?.tool).toBe("send_invoice_reminder");
    expect(planWithRules({ ...sent, invoiceStatus: "PAID" })).toBeNull();
  });

  it("rules plan passes its own guardrails", () => {
    const plan = planWithRules(base)!;
    expect(checkProposedCall(plan, base).ok).toBe(true);
  });
});
