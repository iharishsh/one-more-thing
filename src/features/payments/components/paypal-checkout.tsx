"use client";

import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUsd } from "@/lib/money";

export function PaypalCheckout({
  token,
  priceCents,
  currency,
}: {
  token: string;
  priceCents: number;
  currency: string;
}) {
  const router = useRouter();
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!clientId) {
    return (
      <p className="text-sm text-destructive">
        NEXT_PUBLIC_PAYPAL_CLIENT_ID is not configured.
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-green-700 dark:text-green-400">
        Payment captured. Delivery checklist updated.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pay {formatUsd(priceCents)} via PayPal sandbox. Amount is fixed on the
        server from the published proposal.
      </p>
      <PayPalScriptProvider
        options={{
          clientId,
          currency,
          intent: "capture",
        }}
      >
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect" }}
          createOrder={async () => {
            setError(null);
            const res = await fetch("/api/paypal/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ proposalToken: token }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Could not create order");
            return data.orderId as string;
          }}
          onApprove={async (data) => {
            setError(null);
            const res = await fetch("/api/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.orderID,
                proposalToken: token,
              }),
            });
            const body = await res.json();
            if (!res.ok) {
              setError(body.error ?? "Capture failed");
              return;
            }
            setDone(true);
            router.refresh();
          }}
          onCancel={() => {
            setError(
              "Checkout cancelled. You can try again — no payment was captured.",
            );
          }}
          onError={(err) => {
            setError(err instanceof Error ? err.message : "PayPal error");
          }}
        />
      </PayPalScriptProvider>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
