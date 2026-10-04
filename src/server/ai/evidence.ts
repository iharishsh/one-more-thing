import {
  analysisSchema,
  derivePrimaryOutcome,
  type AnalysisResult,
  type Finding,
} from "@/features/changes/analysis.schema";

function includesQuote(haystack: string, quote: string) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();
  const h = normalize(haystack);
  const q = normalize(quote);
  return q.length > 0 && h.includes(q);
}

function toUnclear(item: Finding, reason?: string): Finding {
  return {
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

/** Move claims without source quotes into unclear. Preserve source metadata. */
export function enforceEvidence(
  analysis: AnalysisResult,
  sources: { originalScope: string; clientMessage: string },
): AnalysisResult {
  const clientText = sources.clientMessage;
  const included: Finding[] = [];
  const additional: Finding[] = [];
  const unclear: Finding[] = [...analysis.unclear];

  for (const item of analysis.included) {
    if (includesQuote(clientText, item.quote) || includesQuote(sources.originalScope, item.quote)) {
      included.push(item);
    } else {
      unclear.push(
        toUnclear(
          item,
          "Quote could not be found in the client message or agreement.",
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
          "Quote could not be found in the client message — do not treat as verified additional work.",
        ),
      );
    }
  }

  return analysisSchema.parse({
    included,
    additional,
    unclear,
    primaryOutcome: derivePrimaryOutcome({ included, additional, unclear }),
    source: analysis.source,
    sourceDetail: analysis.sourceDetail,
    options: analysis.options,
  });
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
