import "server-only";

import { getPaypalClient } from "@/server/paypal/client";

type VerifyResult =
  | { verified: true }
  | { verified: false; reason: string };

/**
 * Verifies webhook authenticity via PayPal verify-webhook-signature.
 * Unverified events must not change payment or delivery state.
 */
export async function verifyPaypalWebhook(args: {
  headers: Headers;
  body: string;
}): Promise<VerifyResult> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return {
      verified: false,
      reason: "PAYPAL_WEBHOOK_ID not configured",
    };
  }

  const transmissionId = args.headers.get("paypal-transmission-id");
  const transmissionTime = args.headers.get("paypal-transmission-time");
  const transmissionSig = args.headers.get("paypal-transmission-sig");
  const certUrl = args.headers.get("paypal-cert-url");
  const authAlgo = args.headers.get("paypal-auth-algo");

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo
  ) {
    return { verified: false, reason: "Missing PayPal webhook signature headers" };
  }

  let webhookEvent: unknown;
  try {
    webhookEvent = JSON.parse(args.body);
  } catch {
    return { verified: false, reason: "Invalid JSON body" };
  }

  // Ensure client credentials exist (throws if missing).
  getPaypalClient();

  const base =
    process.env.PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) {
    return { verified: false, reason: "PayPal OAuth failed for webhook verify" };
  }
  const { access_token: accessToken } = (await tokenRes.json()) as {
    access_token?: string;
  };
  if (!accessToken) {
    return { verified: false, reason: "PayPal OAuth missing access token" };
  }

  const verifyRes = await fetch(
    `${base}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    },
  );

  if (!verifyRes.ok) {
    return {
      verified: false,
      reason: `PayPal verify API HTTP ${verifyRes.status}`,
    };
  }

  const result = (await verifyRes.json()) as {
    verification_status?: string;
  };
  if (result.verification_status === "SUCCESS") {
    return { verified: true };
  }

  return {
    verified: false,
    reason: `verification_status=${result.verification_status ?? "unknown"}`,
  };
}
