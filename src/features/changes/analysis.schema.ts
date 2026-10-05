import { z } from "zod";

export const findingSchema = z.object({
  /** Stable id across reassessments — assigned by the app when missing. */
  id: z.string().min(1).optional(),
  claim: z.string().min(1),
  /** Exact words from the client message, notes, or answer corpus */
  quote: z.string().default(""),
  /** Matching language from the agreement/scope when relevant */
  agreementQuote: z.string().optional(),
  /** Why this classification was suggested */
  reason: z.string().default("Needs freelancer review"),
  /** Suggested question when classification is unclear */
  clarificationQuestion: z.string().optional(),
  /**
   * classification = AI unavailable / offline — freelancer must bucket the item.
   * missing_info = genuine gap that needs notes or a client answer.
   */
  reviewKind: z.enum(["classification", "missing_info"]).optional(),
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
  /**
   * Freelancer recorded an internal decision without publishing a client link.
   * Not client acceptance and not a new agreement.
   */
  freelancerDecision: z
    .object({
      kind: z.literal("included"),
      summary: z.string().min(1),
      decidedAt: z.string().min(1),
    })
    .optional()
    .nullable(),
  options: z.array(optionSchema).default([]),
});

export type Finding = z.infer<typeof findingSchema>;
export type AnalysisResult = z.infer<typeof analysisSchema>;
export type FindingBucket = "included" | "additional" | "unclear";

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

function newFindingId() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureFindingIds(analysis: AnalysisResult): AnalysisResult {
  const stamp = (item: Finding): Finding => ({
    ...item,
    id: item.id?.trim() || newFindingId(),
  });
  const next = {
    ...analysis,
    included: analysis.included.map(stamp),
    additional: analysis.additional.map(stamp),
    unclear: analysis.unclear.map(stamp),
  };
  return {
    ...next,
    primaryOutcome: derivePrimaryOutcome(next),
  };
}

export function moveFindingBucket(
  analysis: AnalysisResult,
  findingId: string,
  to: FindingBucket,
): AnalysisResult {
  const withIds = ensureFindingIds(analysis);
  let moved: Finding | null = null;
  const strip = (bucket: FindingBucket) =>
    withIds[bucket].filter((item) => {
      if (item.id === findingId) {
        moved = item;
        return false;
      }
      return true;
    });

  const included = strip("included");
  const additional = strip("additional");
  const unclear = strip("unclear");
  if (!moved) return withIds;

  const target = [...(to === "included" ? included : to === "additional" ? additional : unclear), moved];
  const next = {
    ...withIds,
    included: to === "included" ? target : included,
    additional: to === "additional" ? target : additional,
    unclear: to === "unclear" ? target : unclear,
  };
  return {
    ...next,
    primaryOutcome: derivePrimaryOutcome(next),
  };
}

export function listFindings(
  analysis: AnalysisResult,
): Array<{ bucket: FindingBucket; item: Finding }> {
  return [
    ...analysis.included.map((item) => ({ bucket: "included" as const, item })),
    ...analysis.additional.map((item) => ({
      bucket: "additional" as const,
      item,
    })),
    ...analysis.unclear.map((item) => ({ bucket: "unclear" as const, item })),
  ];
}
