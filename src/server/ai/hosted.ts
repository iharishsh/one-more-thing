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
  chatJsonWithHosted,
} from "@/server/ai/clients";
import { enforceEvidence, extractJsonObject } from "@/server/ai/evidence";
import type { AnalyzeScopeInput } from "@/server/ai/provider";

/** Throws on config/runtime failure — runAnalysis handles each distinctly. */
export async function analyzeWithHosted(
  input: AnalyzeScopeInput,
): Promise<AnalysisResult> {
  const content = await chatJsonWithHosted({
    system: ANALYSIS_SYSTEM_PROMPT,
    user: buildAnalysisUserPrompt(input),
    temperature: 0.2,
  });

  let parsed: AnalysisResult;
  try {
    parsed = analysisSchema.parse(extractJsonObject(content));
  } catch {
    throw new AiRuntimeError(
      "Model returned invalid or unsupported analysis JSON",
    );
  }

  const enforced = enforceEvidence(parsed, input);
  const usable =
    enforced.included.length +
    enforced.additional.length +
    enforced.unclear.length;
  if (usable === 0) {
    throw new AiRuntimeError("Model returned no usable findings");
  }
  return enforced;
}
