import { capturePaymentOrder } from "@/features/payments/payment.service";
import { jsonError, jsonOk } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await capturePaymentOrder(body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
