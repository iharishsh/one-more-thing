import "server-only";

import {
  analysisSchema,
  derivePrimaryOutcome,
  ensureFindingIds,
  type AnalysisResult,
} from "@/features/changes/analysis.schema";
import type { AnalysisPromptItem } from "@/features/changes/analysis.prompt";
import type { AgreementFacts } from "@/features/changes/agreement-facts";
import { enforceUnconfirmedAgreement } from "@/features/changes/provisional-agreement";
import {
  AiConfigError,
  assertHostedAiConfigured,
  type HostedAttemptRecord,
} from "@/server/ai/clients";
import type { AiFailureKind } from "@/server/ai/failures";

export type AnalyzeScopeInput = {
  originalScope: string;
  clientMessage: string;
  discussionNotes?: string | null;
  clarificationHistory?: string | null;
  priorItems?: AnalysisPromptItem[];
  revisionRoundsTotal?: number | null;
  revisionRoundsUsed?: number;
  agreementFacts?: AgreementFacts;
};

export type AiProvider = {
  analyzeScope(input: AnalyzeScopeInput): Promise<AnalysisResult>;
};

/** Full-request measurement for reliability harnesses (includes retries). */
export type AnalysisMeasurement = {
  result: AnalysisResult;
  /** Wall time for the whole request, including backoff and retries. */
  totalMs: number;
  /** Passed Zod/schema validation on the first transport attempt. */
  firstAttemptValid: boolean;
  /** Final result came from AI with usable findings (not fallback/manual). */
  finalValidOutput: boolean;
  /** Human-review path after analysis failure — not counted as a correct AI result. */
  safeFallback: boolean;
  attempts: HostedAttemptRecord[];
  /** Failure kinds observed on failed attempts (rate_limit vs schema_mismatch, etc.). */
  attemptFailureKinds: AiFailureKind[];
};

function withDerivedFields(
  raw: unknown,
  source: AnalysisResult["source"],
  sourceDetail?: string,
  agreementFacts?: AgreementFacts,
): AnalysisResult {
  const parsed = analysisSchema.parse({
    ...(typeof raw === "object" && raw ? raw : {}),
    source,
    sourceDetail,
  });
  const derived = ensureFindingIds({
    ...parsed,
    primaryOutcome: derivePrimaryOutcome(parsed),
    source,
    sourceDetail,
  });
  return enforceUnconfirmedAgreement(
    agreementFacts?.agreementConfirmed === false,
    derived,
  );
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
    input.agreementFacts,
  );
}

export async function runAnalysisMeasured(
  input: AnalyzeScopeInput,
): Promise<AnalysisMeasurement> {
  const started = Date.now();
  const configured = process.env.AI_PROVIDER ?? "manual";

  if (configured === "manual") {
    const result = await withDerivedFields(
      await (
        await import("./manual")
      ).manualProvider.analyzeScope(input),
      "manual",
      "Decide manually — suggestions aren’t available right now",
      input.agreementFacts,
    );
    return {
      result,
      totalMs: Date.now() - started,
      firstAttemptValid: false,
      finalValidOutput: false,
      safeFallback: false,
      attempts: [],
      attemptFailureKinds: [],
    };
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
      const result = withDerivedFields(
        await analyzeWithOllama(input),
        "ai",
        `ollama:${process.env.OLLAMA_MODEL ?? "unknown"}`,
        input.agreementFacts,
      );
      const usable =
        result.included.length +
        result.additional.length +
        result.unclear.length;
      return {
        result,
        totalMs: Date.now() - started,
        firstAttemptValid: usable > 0,
        finalValidOutput: usable > 0,
        safeFallback: false,
        attempts: [],
        attemptFailureKinds: [],
      };
    }

    const { analyzeWithHosted } = await import("./hosted");
    const hosted = await analyzeWithHosted(input);
    const result = withDerivedFields(
      hosted,
      "ai",
      hosted.sourceDetail ?? "hosted",
      input.agreementFacts,
    );
    const usable =
      result.included.length +
      result.additional.length +
      result.unclear.length;
    return {
      result,
      totalMs: Date.now() - started,
      firstAttemptValid: hosted.firstAttemptValid,
      finalValidOutput: usable > 0,
      safeFallback: false,
      attempts: hosted.attempts,
      attemptFailureKinds: hosted.attempts
        .filter((a) => !a.ok && a.failureKind)
        .map((a) => a.failureKind!),
    };
  } catch (error) {
    if (error instanceof AiConfigError) throw error;

    const detail =
      error instanceof Error ? error.message : "Unknown analysis error";
    const kind =
      error &&
      typeof error === "object" &&
      "kind" in error &&
      typeof (error as { kind: unknown }).kind === "string"
        ? String((error as { kind: string }).kind)
        : "unavailable";
    const attempts =
      error &&
      typeof error === "object" &&
      "attempts" in error &&
      Array.isArray((error as { attempts: unknown }).attempts)
        ? ((error as { attempts: HostedAttemptRecord[] }).attempts ?? [])
        : [];
    console.warn(
      `[ai] Analysis unavailable (${kind}), needs manual review — preserving request context:`,
      detail,
    );
    // Fallback keeps the original clientMessage/agreement for human review;
    // it does not invent included/additional or a price. Not a correct AI result.
    const result = await manualNeedsReview(
      input,
      "fallback",
      "Couldn’t auto-sort this. Decide if it’s already covered or new work — this is not the same as missing client info.",
    );
    return {
      result,
      totalMs: Date.now() - started,
      firstAttemptValid: false,
      finalValidOutput: false,
      safeFallback: true,
      attempts,
      attemptFailureKinds: [
        ...attempts
          .filter((a) => !a.ok && a.failureKind)
          .map((a) => a.failureKind!),
        kind as AiFailureKind,
      ],
    };
  }
}

export async function runAnalysis(
  input: AnalyzeScopeInput,
): Promise<AnalysisResult> {
  return (await runAnalysisMeasured(input)).result;
}

/** @deprecated Prefer runAnalysis */
export async function getAiProvider(): Promise<AiProvider> {
  return {
    async analyzeScope(input) {
      return runAnalysis(input);
    },
  };
}
