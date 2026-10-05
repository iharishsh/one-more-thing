import {
  analysisSchema,
  type AnalysisResult,
} from "@/features/changes/analysis.schema";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
} from "@/features/changes/analysis.prompt";
import {
  AiRuntimeError,
  chatJsonWithHostedDetailed,
  type HostedAttemptRecord,
} from "@/server/ai/clients";
import { enforceEvidence, extractJsonObject } from "@/server/ai/evidence";
import type { AnalyzeScopeInput } from "@/server/ai/provider";

export type HostedAnalysisResult = AnalysisResult & {
  attempts: HostedAttemptRecord[];
  firstAttemptValid: boolean;
  retried: boolean;
};

function validateAnalysisContent(raw: string, input: AnalyzeScopeInput) {
  let parsed: AnalysisResult;
  try {
    const extracted = extractJsonObject(raw);
    parsed = analysisSchema.parse(extracted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    if (/JSON|Unexpected token|extract/i.test(message)) {
      throw new AiRuntimeError(
        "Model returned invalid or unsupported analysis JSON",
        { kind: "invalid_json" },
      );
    }
    throw new AiRuntimeError(
      "Model output failed analysis schema validation",
      { kind: "schema_mismatch" },
    );
  }
  const enforced = enforceEvidence(parsed, input);
  const usable =
    enforced.included.length +
    enforced.additional.length +
    enforced.unclear.length;
  if (usable === 0) {
    throw new AiRuntimeError("Model returned no usable findings", {
      kind: "schema_mismatch",
    });
  }
}

/** Throws on config/runtime failure — runAnalysis handles each distinctly.
 * JSON mode is transport-only; Zod schema validation is enforced here. */
export async function analyzeWithHosted(
  input: AnalyzeScopeInput,
): Promise<HostedAnalysisResult> {
  const detailed = await chatJsonWithHostedDetailed(
    {
      system: ANALYSIS_SYSTEM_PROMPT,
      user: buildAnalysisUserPrompt(input),
      temperature: 0.2,
    },
    {
      validate: (raw) => validateAnalysisContent(raw, input),
    },
  );

  const parsed = analysisSchema.parse(extractJsonObject(detailed.content));
  const enforced = enforceEvidence(parsed, input);
  return {
    ...enforced,
    source: "ai",
    sourceDetail: `${detailed.endpointId}:${detailed.model}`,
    attempts: detailed.attempts,
    firstAttemptValid: detailed.firstAttemptValid,
    retried: detailed.retried,
  };
}
