import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisResult } from "@/features/changes/analysis.schema";
import { getAiAssistStatus } from "@/server/ai/assist-status";

const previous = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  HOSTED_AI_API_KEY: process.env.HOSTED_AI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  HOSTED_AI_CHAIN: process.env.HOSTED_AI_CHAIN,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  OLLAMA_HOST: process.env.OLLAMA_HOST,
};

afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function analysis(source: AnalysisResult["source"]): AnalysisResult {
  return {
    included: [],
    additional: [],
    unclear: [],
    primaryOutcome: "clarify",
    source,
    sourceDetail: source === "fallback" ? "Provider timed out" : undefined,
    options: [],
  };
}

describe("getAiAssistStatus", () => {
  it("does not offer retry in manual mode", () => {
    process.env.AI_PROVIDER = "manual";
    expect(getAiAssistStatus(analysis("fallback"))).toEqual({
      canRetry: false,
      configIssue: null,
    });
  });

  it("shows a config issue when hosted is selected but unconfigured", () => {
    process.env.AI_PROVIDER = "hosted";
    delete process.env.OPENAI_API_KEY;
    delete process.env.HOSTED_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const status = getAiAssistStatus(analysis("fallback"));
    expect(status.canRetry).toBe(false);
    expect(status.configIssue).toMatch(/requires at least one API key/i);
  });

  it("offers retry only for temporary fallback failures when hosted is configured", () => {
    process.env.AI_PROVIDER = "hosted";
    process.env.GROQ_API_KEY = "test-key";

    expect(getAiAssistStatus(analysis("fallback"))).toEqual({
      canRetry: true,
      configIssue: null,
    });
    expect(getAiAssistStatus(analysis("ai"))).toEqual({
      canRetry: false,
      configIssue: null,
    });
    expect(getAiAssistStatus(analysis("manual"))).toEqual({
      canRetry: false,
      configIssue: null,
    });
  });

  it("rejects unknown providers as configuration issues", () => {
    process.env.AI_PROVIDER = "magic";
    const status = getAiAssistStatus(analysis("fallback"));
    expect(status.canRetry).toBe(false);
    expect(status.configIssue).toMatch(/Unknown AI_PROVIDER/i);
  });
});
