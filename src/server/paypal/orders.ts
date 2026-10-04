import "server-only";

import { CheckoutPaymentIntent } from "@paypal/paypal-server-sdk";
import { getOrdersController } from "@/server/paypal/client";

export async function createPaypalOrder(args: {
  amountValue: string;
  currency: string;
  customId: string;
  description: string;
  requestId: string;
}) {
  const controller = getOrdersController();
  const { result } = await controller.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          customId: args.customId,
          description: args.description,
          amount: {
            currencyCode: args.currency,
            value: args.amountValue,
          },
        },
      ],
    },
    paypalRequestId: args.requestId,
    prefer: "return=representation",
  });

  if (!result?.id) {
    throw new Error("PayPal create order returned no id");
  }

  return result;
}

/** Orders v2 — show order details before abandoning or re-creating checkout. */
export async function getPaypalOrder(orderId: string) {
  const controller = getOrdersController();
  const { result } = await controller.getOrder({ id: orderId });

  if (!result) {
    throw new Error("PayPal get order returned empty result");
  }

  return result;
}

export async function capturePaypalOrder(args: {
  orderId: string;
  requestId: string;
}) {
  const controller = getOrdersController();
  const { result } = await controller.captureOrder({
    id: args.orderId,
    paypalRequestId: args.requestId,
    prefer: "return=representation",
  });

  if (!result) {
    throw new Error("PayPal capture returned empty result");
  }

  return result;
}
