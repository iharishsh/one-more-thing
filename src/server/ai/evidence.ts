import {
  analysisSchema,
  derivePrimaryOutcome,
  ensureFindingIds,
  type AnalysisResult,
  type Finding,
} from "@/features/changes/analysis.schema";
import {
  demoteAllToUnclearForConflict,
  demoteVagueTasteLanguage,
  evidenceCorpus,
  hasConflictingEvidence,
} from "@/features/changes/analysis-resolve";

function includesQuote(haystack: string, quote: string) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();
  const h = normalize(haystack);
  const q = normalize(quote);
  return q.length > 0 && h.includes(q);
}

function toUnclear(item: Finding, reason?: string): Finding {
  return {
    id: item.id,
    claim: item.claim,
    quote: item.quote,
    agreementQuote: item.agreementQuote,
    reason:
      reason ??
      item.reason ??
      "Could not verify this claim against the client message or agreement.",
    clarificationQuestion:
      item.clarificationQuestion ??
      "Can you describe the specific change you want?",
  };
}

export type EvidenceSources = {
  originalScope: string;
  clientMessage: string;
  discussionNotes?: string | null;
  clarificationHistory?: string | null;
};

/** Move claims without source quotes into unclear. Preserve source metadata. */
export function enforceEvidence(
  analysis: AnalysisResult,
  sources: EvidenceSources,
): AnalysisResult {
  const clientText = evidenceCorpus({
    clientMessage: sources.clientMessage,
    discussionNotes: sources.discussionNotes,
    clarificationHistory: sources.clarificationHistory,
  });
  const included: Finding[] = [];
  const additional: Finding[] = [];
  const unclear: Finding[] = [...analysis.unclear];

  for (const item of analysis.included) {
    if (
      includesQuote(clientText, item.quote) ||
      includesQuote(sources.originalScope, item.quote)
    ) {
      included.push(item);
    } else {
      unclear.push(
        toUnclear(
          item,
          "Quote could not be found in the request, notes, answers, or agreement.",
        ),
      );
    }
  }
  for (const item of analysis.additional) {
    if (includesQuote(clientText, item.quote)) {
      additional.push(item);
    } else {
      unclear.push(
        toUnclear(
          item,
          "Quote could not be found in the request, notes, or answers — do not treat as verified additional work.",
        ),
      );
    }
  }

  const verified = ensureFindingIds(
    analysisSchema.parse({
      included,
      additional,
      unclear,
      primaryOutcome: derivePrimaryOutcome({ included, additional, unclear }),
      source: analysis.source,
      sourceDetail: analysis.sourceDetail,
      options: analysis.options,
    }),
  );
  const relatedText = [
    sources.discussionNotes?.trim(),
    sources.clarificationHistory?.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  const tasteSafe = demoteVagueTasteLanguage(verified, relatedText);
  if (
    hasConflictingEvidence({
      discussionNotes: sources.discussionNotes,
      clarificationHistory: sources.clarificationHistory,
    })
  ) {
    return demoteAllToUnclearForConflict(tasteSafe);
  }
  return tasteSafe;
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
