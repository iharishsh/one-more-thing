import "server-only";

import { PayPalAgentToolkit } from "@paypal/agent-toolkit/openai";

/** Only the invoicing tools the billing agent may use. Everything else stays disabled. */
export const BILLING_READ_TOOLS = ["get_invoice"] as const;
export const BILLING_WRITE_TOOLS = [
  "create_invoice",
  "send_invoice",
  "send_invoice_reminder",
] as const;

export type BillingWriteTool = (typeof BILLING_WRITE_TOOLS)[number];
export type BillingTool =
  | BillingWriteTool
  | (typeof BILLING_READ_TOOLS)[number];

let toolkit: PayPalAgentToolkit | null = null;

export function getBillingToolkit() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured");
  }
  if (!toolkit) {
    toolkit = new PayPalAgentToolkit({
      clientId,
      clientSecret,
      configuration: {
        actions: {
          invoices: { create: true, send: true, sendReminder: true, get: true },
        },
        context: { sandbox: process.env.PAYPAL_MODE !== "live" },
      },
    });
  }
  return toolkit;
}

export function isBillingWriteTool(name: string): name is BillingWriteTool {
  return (BILLING_WRITE_TOOLS as readonly string[]).includes(name);
}

/** Runs one toolkit call. The toolkit returns errors as JSON instead of throwing. */
export async function runBillingTool(
  tool: BillingTool,
  args: Record<string, unknown>,
): Promise<unknown> {
  const message = await getBillingToolkit().handleToolCall({
    id: `call_${tool}`,
    type: "function",
    function: { name: tool, arguments: JSON.stringify(args) },
  });
  const content =
    typeof message.content === "string" ? message.content : "null";
  const parsed: unknown = JSON.parse(content);
  if (parsed && typeof parsed === "object") {
    // Toolkit failures come back as { error } or { ok: false, message }.
    const p = parsed as {
      ok?: boolean;
      message?: string;
      error?: { message?: string } | string;
    };
    if (p.error || p.ok === false) {
      const detail =
        typeof p.error === "string"
          ? p.error
          : (p.error?.message ?? p.message ?? "unknown error");
      throw new Error(`PayPal ${tool} failed: ${detail}`);
    }
  }
  return parsed;
}

/** create_invoice returns either the invoice (`id`) or a HATEOAS link to it. */
export function extractInvoiceId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as { id?: unknown; href?: unknown };
  if (typeof r.id === "string") return r.id;
  if (typeof r.href === "string") {
    const match = r.href.match(/\/invoices\/([^/?]+)/);
    return match?.[1] ?? null;
  }
  return null;
}

// --- Payouts (not in the Agent Toolkit; called on the REST API directly) ---

let payoutToken: { value: string; expiresAt: number } | null = null;

function paypalApiBase() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken() {
  if (payoutToken && payoutToken.expiresAt > Date.now() + 60_000) {
    return payoutToken.value;
  }
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured");
  }
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new Error("PayPal auth failed");
  payoutToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
  };
  return payoutToken.value;
}

async function paypalRequest(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${paypalApiBase()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await paypalAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail =
      (data.message as string | undefined) ??
      (data.name as string | undefined) ??
      `HTTP ${res.status}`;
    throw new Error(`PayPal payout failed: ${detail}`);
  }
  return data;
}

export async function sendPaypalPayout(args: {
  receiver: string;
  value: string;
  currency: string;
  note: string;
  sender_batch_id: string;
}) {
  const data = await paypalRequest("/v1/payments/payouts", {
    method: "POST",
    body: {
      sender_batch_header: {
        sender_batch_id: args.sender_batch_id,
        email_subject: "You have a payout",
        email_message: args.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: args.receiver,
          amount: { value: args.value, currency: args.currency },
          note: args.note,
          sender_item_id: args.sender_batch_id,
        },
      ],
    },
  });
  const header = data.batch_header as
    | { payout_batch_id?: string; batch_status?: string }
    | undefined;
  if (!header?.payout_batch_id) throw new Error("PayPal returned no payout id");
  return { batchId: header.payout_batch_id, status: header.batch_status ?? null, raw: data };
}

export async function getPaypalPayoutStatus(batchId: string) {
  const data = await paypalRequest(`/v1/payments/payouts/${encodeURIComponent(batchId)}`);
  return (data.batch_header as { batch_status?: string } | undefined)?.batch_status ?? null;
}
