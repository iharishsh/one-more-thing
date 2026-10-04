import { z } from "zod";
import { analysisSchema } from "@/features/changes/analysis.schema";

export const createChangeSchema = z.object({
  projectId: z.string().min(1),
  clientMessage: z.string().min(1).max(20_000),
});

export const updateAnalysisSchema = z.object({
  analysis: analysisSchema,
});

export type CreateChangeInput = z.infer<typeof createChangeSchema>;
