import { z } from "zod";

export const findingSchema = z.object({
  claim: z.string().min(1),
  /** Exact words from the client message */
  quote: z.string().default(""),
  /** Matching language from the agreement/scope when relevant */
  agreementQuote: z.string().optional(),
  /** Why this classification was suggested */
  reason: z.string().default("Needs freelancer review"),
  /** Suggested question when classification is unclear */
  clarificationQuestion: z.string().optional(),
});

const optionSchema = z
  .object({
    kind: z.enum(["extra_price", "included_ack", "clarify", "swap", "delay"]),
    summary: z.string(),
    /** Suggestion only — UI must not auto-fill publish price from this */
    suggestedPriceCents: z.number().int().nonnegative().optional(),
    /** Legacy field from older analyses */
    priceCents: z.number().int().nonnegative().optional(),
  })
  .transform((o) => ({
    kind:
      o.kind === "swap" || o.kind === "delay"
        ? ("extra_price" as const)
        : (o.kind as "extra_price" | "included_ack" | "clarify"),
    summary: o.summary,
    suggestedPriceCents: o.suggestedPriceCents ?? o.priceCents,
  }));

export const analysisSchema = z.object({
  included: z.array(findingSchema).default([]),
  additional: z.array(findingSchema).default([]),
  unclear: z.array(findingSchema).default([]),
  /** Overall recommended next step for the freelancer */
  primaryOutcome: z
    .enum(["clarify", "included", "additional", "mixed"])
    .default("clarify"),
  /** Where this analysis came from — never pretend fallback is AI success */
  source: z.enum(["ai", "fallback", "manual"]).default("manual"),
  sourceDetail: z.string().optional(),
  options: z.array(optionSchema).default([]),
});

export type Finding = z.infer<typeof findingSchema>;
export type AnalysisResult = z.infer<typeof analysisSchema>;

export function derivePrimaryOutcome(
  analysis: Pick<AnalysisResult, "included" | "additional" | "unclear">,
): AnalysisResult["primaryOutcome"] {
  const hasI = analysis.included.length > 0;
  const hasA = analysis.additional.length > 0;
  const hasU = analysis.unclear.length > 0;
  if (hasU && !hasA && !hasI) return "clarify";
  if (hasU && (hasA || hasI)) return "mixed";
  if (hasA && hasI) return "mixed";
  if (hasA) return "additional";
  if (hasI) return "included";
  return "clarify";
}
