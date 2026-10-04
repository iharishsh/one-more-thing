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
      claim: "Needs manual review",
      quote: pickQuote(unit) || pickQuote(input.clientMessage) || "—",
      agreementQuote,
      reason:
        "Automatic keyword rules cannot reliably decide whether this is included work or additional paid work. Review the request against the agreement and classify it yourself.",
      clarificationQuestion:
        "Which parts of this request are already covered by the agreement, and which (if any) should be new paid work?",
    }));

    return analysisSchema.parse({
      included: [],
      additional: [],
      unclear,
      primaryOutcome: "clarify",
      source: "manual",
      sourceDetail: "Needs manual review — no automatic billing classification",
      options: [
        {
          kind: "clarify",
          summary:
            "Review the client request against the agreement, then classify before acting",
          suggestedPriceCents: undefined,
        },
      ],
    });
  },
};
