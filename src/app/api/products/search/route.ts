import { requireFreelancer } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/http";
import {
  isChannel3Configured,
  searchProducts,
} from "@/features/products/product.service";

export async function GET() {
  return jsonOk({ configured: isChannel3Configured() });
}

export async function POST(request: Request) {
  try {
    await requireFreelancer();
    if (!isChannel3Configured()) {
      return jsonError(
        new Error(
          "Add CHANNEL3_API_KEY (promo PAYPAL-HACKATHON-2026) to search products.",
        ),
        503,
      );
    }
    const body = await request.json();
    const result = await searchProducts(body);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
