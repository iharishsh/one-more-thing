import "server-only";

import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
} from "@paypal/paypal-server-sdk";

let client: Client | null = null;
let ordersController: OrdersController | null = null;

export function getPaypalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured");
  }

  if (!client) {
    client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      environment:
        process.env.PAYPAL_MODE === "live"
          ? Environment.Production
          : Environment.Sandbox,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: false },
        logResponse: { logHeaders: false },
      },
    });
  }

  return client;
}

export function getOrdersController() {
  if (!ordersController) {
    ordersController = new OrdersController(getPaypalClient());
  }
  return ordersController;
}
