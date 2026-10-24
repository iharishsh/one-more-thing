import { WebhookProcessingStatus } from "@/generated/prisma/client";
import { applyPaidInvoiceById } from "@/features/billing/billing-agent.service";
import {
  claimWebhookEvent,
  markWebhookProcessed,
  processVerifiedCapture,
  recordWebhookEvent,
} from "@/features/payments/payment.service";
import { prisma } from "@/server/db";
import { jsonError, jsonOk } from "@/server/http";
import { verifyPaypalWebhook } from "@/server/paypal/webhooks";

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const verification = await verifyPaypalWebhook({
      headers: request.headers,
      body: bodyText,
    });

    if (!verification.verified) {
      return jsonError(
        new Error(`Webhook not verified: ${verification.reason}`),
        400,
      );
    }

    const payload = JSON.parse(bodyText) as {
      id?: string;
      event_type?: string;
      resource?: {
        id?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
        amount?: { value?: string; currency_code?: string };
        custom_id?: string;
        status?: string;
      };
    };

    if (!payload.id || !payload.event_type) {
      return jsonError(new Error("Invalid webhook payload"), 400);
    }

    const existing = await recordWebhookEvent({
      eventId: payload.id,
      eventType: payload.event_type,
      payload,
    });

    if (existing.status === WebhookProcessingStatus.PROCESSED) {
      return jsonOk({ ok: true, duplicate: true });
    }

    const beforeClaim = existing.claimedAt?.getTime() ?? 0;
    const claimed = await claimWebhookEvent(payload.id);

    if (claimed.status === WebhookProcessingStatus.PROCESSED) {
      return jsonOk({ ok: true, duplicate: true });
    }

    // Concurrent worker already holds a fresh claim
    if (
      claimed.claimedAt &&
      beforeClaim > 0 &&
      claimed.claimedAt.getTime() === beforeClaim &&
      claimed.status !== WebhookProcessingStatus.FAILED
    ) {
      return jsonOk({ ok: true, inProgress: true });
    }

    if (payload.event_type === "INVOICING.INVOICE.PAID") {
      try {
        // The invoice is re-read from PayPal before anything is recorded.
        const invoiceId = payload.resource?.id;
        const result = invoiceId
          ? await applyPaidInvoiceById(invoiceId)
          : { applied: false, reason: "missing invoice id" };
        await markWebhookProcessed(
          payload.id,
          result.applied
            ? WebhookProcessingStatus.PROCESSED
            : WebhookProcessingStatus.IGNORED,
        );
        return jsonOk({ ok: true, ...result });
      } catch (error) {
        await markWebhookProcessed(
          payload.id,
          WebhookProcessingStatus.FAILED,
          error instanceof Error ? error.message : "invoice sync failed",
        );
        throw error;
      }
    }

    if (payload.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      await markWebhookProcessed(payload.id, WebhookProcessingStatus.IGNORED);
      return jsonOk({ ok: true, ignored: true });
    }

    try {
      const orderId =
        payload.resource?.supplementary_data?.related_ids?.order_id;
      const paymentId = payload.resource?.custom_id;
      if (!orderId || !paymentId) {
        await markWebhookProcessed(
          payload.id,
          WebhookProcessingStatus.FAILED,
          "Missing order_id or custom_id",
        );
        return jsonError(new Error("Missing order or payment id"), 400);
      }

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment || payment.paypalOrderId !== orderId) {
        await markWebhookProcessed(
          payload.id,
          WebhookProcessingStatus.FAILED,
          "Payment/order mismatch",
        );
        return jsonError(new Error("Payment/order mismatch"), 400);
      }

      await processVerifiedCapture({
        paymentId,
        paypalOrderId: orderId,
        capturePayload: {
          id: orderId,
          status: "COMPLETED",
          purchaseUnits: [
            {
              payments: {
                captures: [
                  {
                    id: payload.resource?.id,
                    status: payload.resource?.status ?? "COMPLETED",
                    amount: {
                      value: payload.resource?.amount?.value,
                      currencyCode: payload.resource?.amount?.currency_code,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      await markWebhookProcessed(payload.id, WebhookProcessingStatus.PROCESSED);
      return jsonOk({ ok: true, verified: true });
    } catch (error) {
      await markWebhookProcessed(
        payload.id,
        WebhookProcessingStatus.FAILED,
        error instanceof Error ? error.message : "capture failed",
      );
      throw error;
    }
  } catch (error) {
    return jsonError(error, 400);
  }
}
