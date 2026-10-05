import "server-only";

import type { AnalysisResult } from "@/features/changes/analysis.schema";
import { AiConfigError, assertHostedAiConfigured } from "@/server/ai/clients";

export type AiAssistStatus = {
  /** Temporary provider failure — Retry AI may succeed. */
  canRetry: boolean;
  /** Missing/invalid provider setup — do not offer Retry as if it will help. */
  configIssue: string | null;
};

/**
 * Decide whether Retry AI is appropriate for this analysis.
 * AI_PROVIDER alone is not enough — hosted may be selected but unconfigured.
 */
export function getAiAssistStatus(analysis: AnalysisResult): AiAssistStatus {
  const provider = process.env.AI_PROVIDER ?? "manual";

  if (provider === "manual") {
    return { canRetry: false, configIssue: null };
  }

  if (provider === "hosted") {
    try {
      assertHostedAiConfigured();
    } catch (error) {
      const message =
        error instanceof AiConfigError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Hosted AI is not configured";
      return { canRetry: false, configIssue: message };
    }
  } else if (provider === "ollama") {
    if (!process.env.OLLAMA_BASE_URL?.trim() && !process.env.OLLAMA_HOST?.trim()) {
      // Ollama often defaults to localhost — still allow retry for runtime down.
      // Only treat as config if model is missing when required.
    }
  } else {
    return {
      canRetry: false,
      configIssue: `Unknown AI_PROVIDER "${provider}". Use manual, ollama, or hosted.`,
    };
  }

  // Retry only after a temporary failure path (runtime → fallback analysis).
  if (analysis.source === "fallback") {
    return { canRetry: true, configIssue: null };
  }

  return { canRetry: false, configIssue: null };
}
