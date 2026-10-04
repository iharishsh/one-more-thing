import { z } from "zod";

export const productSearchSchema = z.object({
  query: z.string().min(2).max(500),
  limit: z.number().int().min(1).max(10).default(5),
  maxPrice: z.number().positive().optional(),
  minPrice: z.number().nonnegative().optional(),
});

export type ProductSearchInput = z.infer<typeof productSearchSchema>;

export type SourcedProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceCentsEstimate: number | null;
  currency: string | null;
  buyUrl: string | null;
  retailer: string | null;
  retrievedAt: string;
};

export const quoteLineSchema = z.object({
  kind: z.enum(["labour", "product", "materials", "other"]),
  label: z.string().min(1).max(300),
  amountCents: z.number().int().nonnegative(),
  /** Channel3 / retail prices are estimates until the freelancer verifies */
  estimate: z.boolean().default(false),
  product: z
    .object({
      id: z.string(),
      title: z.string(),
      imageUrl: z.string().nullable().optional(),
      priceCentsEstimate: z.number().int().nonnegative().nullable().optional(),
      buyUrl: z.string().nullable().optional(),
      retailer: z.string().nullable().optional(),
      retrievedAt: z.string(),
    })
    .nullable()
    .optional(),
});

export type QuoteLine = z.infer<typeof quoteLineSchema>;
