// Pure guardrails for the billing agent. The model may propose any toolkit call;
// only calls that pass here are shown to the freelancer, and they are re-checked
// against fresh state right before execution.

export type BillingState = {
  proposalId: string;
  summary: string;
  priceCents: number;
  currency: string;
  clientEmail: string;
  invoiceId: string | null;
  /** Live PayPal invoice status (DRAFT, SENT, UNPAID, PAID, ...) when an invoice exists. */
  invoiceStatus: string | null;
  remindersSent: number;
  /** Hours since the last invoice email (send or reminder); null if none yet. */
  hoursSinceLastEmail: number | null;
  /** Name shown as the seller on the invoice; set by the app, never the model. */
  businessName?: string | null;
};

export type ProposedCall = { tool: string; args: Record<string, unknown> };

export type GuardrailResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string };

export const MAX_REMINDERS = 3;
/** Stands in for the client's email in model prompts (data minimisation). */
export const CLIENT_EMAIL_PLACEHOLDER = "client@on-file.invalid";
export const REMINDER_WAIT_HOURS = 72;
const REMINDABLE = new Set(["SENT", "UNPAID", "PARTIALLY_PAID"]);
const SETTLED = new Set(["PAID", "MARKED_AS_PAID", "CANCELLED", "REFUNDED"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

export function centsFromDecimal(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

function itemsTotalCents(items: unknown): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  let total = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const { quantity, unit_amount, discount, tax } = item as Record<
      string,
      unknown
    >;
    if (discount || tax) return null;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const unit = centsFromDecimal(
      (unit_amount as { value?: unknown } | undefined)?.value,
    );
    if (unit === null) return null;
    total += Math.round(qty * unit);
  }
  return total;
}

function recipientEmails(recipients: unknown): string[] {
  if (!Array.isArray(recipients)) return [];
  return recipients.map((r) =>
    String(
      (r as { billing_info?: { email_address?: unknown } })?.billing_info
        ?.email_address ?? "",
    )
      .trim()
      .toLowerCase(),
  );
}

export function isInvoiceSettled(state: BillingState) {
  return state.invoiceStatus !== null && SETTLED.has(state.invoiceStatus);
}

export function checkProposedCall(
  call: ProposedCall,
  state: BillingState,
): GuardrailResult {
  const { tool, args } = call;

  if (tool === "create_invoice") {
    if (state.invoiceId) {
      return { ok: false, error: "An invoice already exists for this proposal" };
    }
    if (String(args.currency_code ?? "").toUpperCase() !== state.currency) {
      return { ok: false, error: `Currency must be ${state.currency}` };
    }
    const total = itemsTotalCents(args.items);
    if (total !== state.priceCents) {
      return {
        ok: false,
        error: `Invoice items must total exactly the accepted price (${(state.priceCents / 100).toFixed(2)})`,
      };
    }
    const emails = recipientEmails(args.primary_recipients);
    const allowed = [state.clientEmail.toLowerCase(), CLIENT_EMAIL_PLACEHOLDER];
    if (emails.length !== 1 || !allowed.includes(emails[0])) {
      return {
        ok: false,
        error: "The only recipient must be the client email the freelancer entered",
      };
    }
    // Strip anything that could change what the client pays.
    const rest = { ...args };
    // PayPal fills the invoicer from the merchant account; models tend to invent one.
    for (const key of Object.keys(rest)) {
      if (key.startsWith("invoicer_") || key === "invoice_number") {
        delete rest[key];
      }
    }
    for (const key of [
      "allow_tip",
      "shipping_cost",
      "allow_partial_payment",
      "minimum_partial_payment_amount",
    ]) {
      delete rest[key];
    }
    return {
      ok: true,
      args: {
        ...rest,
        currency_code: state.currency,
        // The model only ever sees a placeholder; the real address is set here.
        primary_recipients: [
          { billing_info: { email_address: state.clientEmail } },
        ],
        reference: `omt:${state.proposalId}`,
        ...(state.businessName
          ? { invoicer_business_name: state.businessName.slice(0, 300) }
          : {}),
      },
    };
  }

  if (tool === "send_invoice") {
    if (!state.invoiceId || args.invoice_id !== state.invoiceId) {
      return { ok: false, error: "Can only send this proposal's invoice" };
    }
    if (state.invoiceStatus !== "DRAFT") {
      return { ok: false, error: "Invoice is not a draft" };
    }
    return {
      ok: true,
      args: {
        invoice_id: state.invoiceId,
        note: typeof args.note === "string" ? args.note : undefined,
        send_to_recipient: true,
      },
    };
  }

  if (tool === "send_invoice_reminder") {
    if (!state.invoiceId || args.invoice_id !== state.invoiceId) {
      return { ok: false, error: "Can only remind about this proposal's invoice" };
    }
    if (!state.invoiceStatus || !REMINDABLE.has(state.invoiceStatus)) {
      return { ok: false, error: "Invoice is not awaiting payment" };
    }
    if (state.remindersSent >= MAX_REMINDERS) {
      return { ok: false, error: `Reminder limit (${MAX_REMINDERS}) reached` };
    }
    return {
      ok: true,
      args: {
        invoice_id: state.invoiceId,
        subject: typeof args.subject === "string" ? args.subject : undefined,
        note: typeof args.note === "string" ? args.note : undefined,
      },
    };
  }

  return { ok: false, error: `Tool ${tool} is not allowed` };
}

/** Deterministic next step — used without a hosted model and when the model fails. */
export function planWithRules(
  state: BillingState,
): (ProposedCall & { rationale: string }) | null {
  const amount = (state.priceCents / 100).toFixed(2);
  if (!state.invoiceId) {
    return {
      tool: "create_invoice",
      rationale: `The client accepted the change but hasn't paid. A PayPal invoice for exactly ${amount} ${state.currency} gives them another way to pay.`,
      args: {
        currency_code: state.currency,
        note: "Thanks for approving this change. You can pay securely with PayPal.",
        primary_recipients: [
          { billing_info: { email_address: state.clientEmail } },
        ],
        items: [
          {
            name: state.summary.slice(0, 200) || "Approved change",
            quantity: "1",
            unit_amount: { currency_code: state.currency, value: amount },
          },
        ],
      },
    };
  }
  if (state.invoiceStatus === "DRAFT") {
    return {
      tool: "send_invoice",
      rationale: "The invoice is still a draft. Sending it emails the client a PayPal payment link.",
      args: { invoice_id: state.invoiceId },
    };
  }
  if (
    state.invoiceStatus &&
    REMINDABLE.has(state.invoiceStatus) &&
    state.remindersSent < MAX_REMINDERS &&
    (state.hoursSinceLastEmail ?? Infinity) >= REMINDER_WAIT_HOURS
  ) {
    return {
      tool: "send_invoice_reminder",
      rationale: `The invoice is ${state.invoiceStatus.toLowerCase()}. A polite reminder is the next step (${state.remindersSent + 1} of ${MAX_REMINDERS}).`,
      args: {
        invoice_id: state.invoiceId,
        note: "Friendly reminder about the approved change. Thanks!",
      },
    };
  }
  return null;
}
