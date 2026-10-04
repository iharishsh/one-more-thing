import "server-only";

import { Channel3 } from "@channel3/sdk";
import type { Channel3Api } from "@channel3/sdk";
import {
  productSearchSchema,
  type ProductSearchInput,
  type SourcedProduct,
} from "@/features/products/product.schema";

function offerPriceCents(offer: Channel3Api.ProductOffer | undefined): {
  cents: number | null;
  currency: string | null;
} {
  if (!offer?.price) return { cents: null, currency: null };
  const amount = offer.price.price;
  const cents =
    typeof amount === "number" && Number.isFinite(amount)
      ? Math.round(amount * 100)
      : null;
  return { cents, currency: offer.price.currency ?? null };
}

function productImageUrl(raw: Channel3Api.Product): string | null {
  const images = raw.images ?? [];
  if (images.length === 0) return null;
  const main =
    images.find((img) => img.is_main_image) ?? images[0];
  // Prefer background-removed CDN shot for dense grids when available
  return main.cleaned_url?.trim() || main.url?.trim() || null;
}

function mapProduct(raw: Channel3Api.Product): SourcedProduct | null {
  if (!raw.id || !raw.title) return null;
  const offer = raw.offers?.[0];
  const { cents, currency } = offerPriceCents(offer);

  return {
    id: raw.id,
    title: raw.title,
    imageUrl: productImageUrl(raw),
    priceCentsEstimate: cents,
    currency: currency ?? "USD",
    buyUrl: offer?.url ?? null,
    retailer: offer?.domain ?? raw.brands?.[0]?.name ?? null,
    retrievedAt: new Date().toISOString(),
  };
}

export function isChannel3Configured() {
  return Boolean(process.env.CHANNEL3_API_KEY?.trim());
}

/**
 * Generic product search for optional materials/products on a change proposal.
 * Requires CHANNEL3_API_KEY (hackathon promo: PAYPAL-HACKATHON-2026).
 */
export async function searchProducts(
  raw: ProductSearchInput,
): Promise<{ products: SourcedProduct[]; provider: "channel3" }> {
  if (!isChannel3Configured()) {
    throw new Error(
      "Product search is not configured. Add CHANNEL3_API_KEY to enable Channel3.",
    );
  }

  const input = productSearchSchema.parse(raw);
  const client = new Channel3({ apiKey: process.env.CHANNEL3_API_KEY });

  const filters: Channel3Api.SearchFilters = {};
  if (input.minPrice != null || input.maxPrice != null) {
    filters.price = {
      ...(input.minPrice != null ? { min_price: input.minPrice } : {}),
      ...(input.maxPrice != null ? { max_price: input.maxPrice } : {}),
    };
  }

  const page = await client.products.search({
    query: input.query,
    limit: input.limit,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
  });

  const products = (page.data ?? [])
    .map((p) => mapProduct(p))
    .filter((p): p is SourcedProduct => Boolean(p));

  return { products, provider: "channel3" };
}
