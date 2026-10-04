import "server-only";

import {
  analysisSchema,
  derivePrimaryOutcome,
  type AnalysisResult,
} from "@/features/changes/analysis.schema";
import type { AgreementFacts } from "@/features/changes/agreement-facts";
import {
  AiConfigError,
  assertHostedAiConfigured,
} from "@/server/ai/clients";

export type AnalyzeScopeInput = {
  originalScope: string;
  clientMessage: string;
  revisionRoundsTotal?: number | null;
  revisionRoundsUsed?: number;
  agreementFacts?: AgreementFacts;
};

export type AiProvider = {
  analyzeScope(input: AnalyzeScopeInput): Promise<AnalysisResult>;
};

function withDerivedFields(
  raw: unknown,
  source: AnalysisResult["source"],
  sourceDetail?: string,
): AnalysisResult {
  const parsed = analysisSchema.parse({
    ...(typeof raw === "object" && raw ? raw : {}),
    source,
    sourceDetail,
  });
  return {
    ...parsed,
    primaryOutcome: derivePrimaryOutcome(parsed),
    source,
    sourceDetail,
  };
}

async function manualNeedsReview(
  input: AnalyzeScopeInput,
  source: AnalysisResult["source"],
  sourceDetail: string,
): Promise<AnalysisResult> {
  const { manualProvider } = await import("./manual");
  return withDerivedFields(
    await manualProvider.analyzeScope(input),
    source,
    sourceDetail,
  );
}

export async function runAnalysis(
  input: AnalyzeScopeInput,
): Promise<AnalysisResult> {
  const configured = process.env.AI_PROVIDER ?? "manual";

  if (configured === "manual") {
    return manualNeedsReview(
      input,
      "manual",
      "Needs manual review — no automatic billing classification",
    );
  }

  // Fail closed on missing configuration — do not silently use another provider.
  if (configured === "hosted") {
    assertHostedAiConfigured();
  } else if (configured !== "ollama") {
    throw new AiConfigError(
      `Unknown AI_PROVIDER "${configured}". Use manual, ollama, or hosted.`,
    );
  }

  try {
    if (configured === "ollama") {
      const { analyzeWithOllama } = await import("./ollama");
      return withDerivedFields(
        await analyzeWithOllama(input),
        "ai",
        `ollama:${process.env.OLLAMA_MODEL ?? "unknown"}`,
      );
    }

    const { analyzeWithHosted } = await import("./hosted");
    return withDerivedFields(
      await analyzeWithHosted(input),
      "ai",
      process.env.HOSTED_AI_MODEL ?? "hosted",
    );
  } catch (error) {
    if (error instanceof AiConfigError) throw error;

    const detail =
      error instanceof Error ? error.message : "Unknown analysis error";
    console.warn("[ai] Analysis unavailable, needs manual review:", detail);
    return manualNeedsReview(
      input,
      "fallback",
      `Analysis unavailable (${detail}). Needs manual review — no automatic billing classification.`,
    );
  }
}

/** @deprecated Prefer runAnalysis */
export async function getAiProvider(): Promise<AiProvider> {
  return {
    async analyzeScope(input) {
      return runAnalysis(input);
    },
  };
}
