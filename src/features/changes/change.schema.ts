import { z } from "zod";
import { analysisSchema } from "@/features/changes/analysis.schema";

export const createChangeSchema = z.object({
  projectId: z.string().min(1),
  clientMessage: z.string().min(1).max(20_000),
  discussionNotes: z.string().max(20_000).optional(),
  discussedPriceCents: z.number().int().nonnegative().optional(),
  discussedDeliveryNote: z.string().max(500).optional(),
});

export const updateAnalysisSchema = z.object({
  analysis: analysisSchema,
});

export const addDiscussionContextSchema = z.object({
  notes: z.string().min(1).max(20_000),
  /** When set, notes are treated as answering this unclear item. */
  relatedItemId: z.string().min(1).optional(),
  discussedPriceCents: z.number().int().nonnegative().optional(),
  discussedDeliveryNote: z.string().max(500).optional(),
  /** Re-run analysis after saving notes (default true). */
  reassess: z.boolean().optional().default(true),
});

export type CreateChangeInput = z.infer<typeof createChangeSchema>;
export type AddDiscussionContextInput = z.infer<
  typeof addDiscussionContextSchema
>;
