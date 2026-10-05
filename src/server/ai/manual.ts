import {
  analysisSchema,
  type AnalysisResult,
} from "@/features/changes/analysis.schema";
import type { AiProvider, AnalyzeScopeInput } from "@/server/ai/provider";

function pickQuote(text: string, max = 160) {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Honest offline / fallback analyzer.
 * Preserves the request and agreement for review — never classifies
 * included vs additional work or invents a price from keyword cues.
 */
export const manualProvider: AiProvider = {
  async analyzeScope(input: AnalyzeScopeInput): Promise<AnalysisResult> {
    const chunks = input.clientMessage
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const units = chunks.length > 0 ? chunks : [input.clientMessage.trim() || "—"];
    const agreementQuote = pickQuote(input.originalScope, 160);

    const unclear = units.map((unit) => ({
      claim: pickQuote(unit, 88) || "Client request",
      quote: pickQuote(unit) || pickQuote(input.clientMessage) || "—",
      agreementQuote,
      reason:
        "Couldn’t auto-sort this. Use the menu to say if it’s already covered or new work — this is not the same as missing client info.",
      reviewKind: "classification" as const,
    }));

    return analysisSchema.parse({
      included: [],
      additional: [],
      unclear,
      primaryOutcome: "clarify",
      source: "manual",
      sourceDetail: "Decide manually — suggestions aren’t available right now",
      options: [
        {
          kind: "clarify",
          summary:
            "Compare the request to what’s agreed, then choose covered or new work",
          suggestedPriceCents: undefined,
        },
      ],
    });
  },
};
