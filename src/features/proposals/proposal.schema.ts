import { z } from "zod";
import { quoteLineSchema } from "@/features/products/product.schema";

export const publishProposalSchema = z.object({
  summary: z.string().min(1).max(2000),
  priceCents: z.number().int().nonnegative(),
  currency: z.literal("USD").default("USD"),
  /** Start with additional paid work + included ack + clarify only */
  optionKind: z.enum(["extra_price", "included_ack", "clarify"]),
  optionSummary: z.string().min(1).max(2000),
  /** Concrete added work lines shown to the client */
  deliverableTitles: z.array(z.string().min(1).max(200)).default([]),
  completionCriteria: z.string().max(2000).optional(),
  exclusions: z.string().max(2000).optional(),
  deliveryImpact: z.string().max(500).optional(),
  existingWorkNote: z.string().max(2000).optional(),
  deliveryNote: z.string().max(5000).optional(),
  /**
   * Explicit: this included amendment uses one contractual revision round.
   * Default false — acknowledgment / clarification / ordinary included notes do not consume.
   */
  consumesRevisionRound: z.boolean().default(false),
  /** Optional labour / product / materials lines (Channel3 products attach here) */
  quoteLines: z.array(quoteLineSchema).default([]),
});

export const acceptProposalSchema = z.object({
  clientName: z.string().min(1).max(200).optional(),
  /** Optional — used to send a PayPal invoice if they don't pay right away. */
  clientEmail: z.union([z.email().max(320), z.literal("")]).optional(),
  acknowledgment: z
    .string()
    .min(1)
    .max(500)
    .default("I accept these exact proposal terms."),
});

export const clientResponseSchema = z.object({
  action: z.enum(["request_changes", "decline"]),
  message: z.string().min(1).max(2000),
  clientName: z.string().min(1).max(200).optional(),
});

export type PublishProposalInput = z.infer<typeof publishProposalSchema>;
export type AcceptProposalInput = z.infer<typeof acceptProposalSchema>;
export type ClientResponseInput = z.infer<typeof clientResponseSchema>;
