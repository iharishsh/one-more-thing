import { afterEach, describe, expect, it } from "vitest";
import { AiConfigError } from "@/server/ai/clients";
import { runAnalysis } from "@/server/ai/provider";
import { runProjectRefine } from "@/server/ai/refine-project";

const previous = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  HOSTED_AI_API_KEY: process.env.HOSTED_AI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  HOSTED_AI_CHAIN: process.env.HOSTED_AI_CHAIN,
};

afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("AI configuration failures", () => {
  it("hosted analysis fails closed when no gateway keys are configured", async () => {
    process.env.AI_PROVIDER = "hosted";
    delete process.env.OPENAI_API_KEY;
    delete process.env.HOSTED_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    await expect(
      runAnalysis({
        originalScope: "Landing page with two revision rounds.",
        clientMessage: "Please tweak the hero.",
      }),
    ).rejects.toBeInstanceOf(AiConfigError);
  });

  it("hosted refine fails closed when no gateway keys are configured", async () => {
    process.env.AI_PROVIDER = "hosted";
    delete process.env.OPENAI_API_KEY;
    delete process.env.HOSTED_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    await expect(
      runProjectRefine({
        title: "Landing",
        originalScope: "Build a marketing landing page with hero and form.",
        deliverablesText: "Hero\nContact form",
      }),
    ).rejects.toBeInstanceOf(AiConfigError);
  });
});
