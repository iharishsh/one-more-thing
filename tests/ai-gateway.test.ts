import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiConfigError,
  chatJsonWithHosted,
  resolveHostedEndpoints,
} from "@/server/ai/clients";

const tracked = [
  "HOSTED_AI_CHAIN",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENAI_API_KEY",
  "HOSTED_AI_API_KEY",
  "HOSTED_AI_BASE_URL",
  "HOSTED_AI_MODEL",
] as const;

const previous: Partial<Record<(typeof tracked)[number], string | undefined>> =
  Object.fromEntries(tracked.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of tracked) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function clearHostedKeys() {
  for (const key of tracked) delete process.env[key];
}

describe("hosted AI gateway", () => {
  it("resolves only endpoints that have API keys, in chain order", () => {
    clearHostedKeys();
    process.env.HOSTED_AI_CHAIN = "openrouter,groq,openai";
    process.env.GROQ_API_KEY = "g-key";
    process.env.OPENROUTER_API_KEY = "or-key";

    const endpoints = resolveHostedEndpoints();
    expect(endpoints.map((e) => e.id)).toEqual(["openrouter", "groq"]);
  });

  it("fails closed when no hosted keys are configured", async () => {
    clearHostedKeys();
    await expect(
      chatJsonWithHosted({ system: "s", user: "u" }),
    ).rejects.toBeInstanceOf(AiConfigError);
  });

  it("failovers from groq to openrouter when groq is rate-limited", async () => {
    clearHostedKeys();
    process.env.HOSTED_AI_CHAIN = "groq,openrouter";
    process.env.GROQ_API_KEY = "g-key";
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.GROQ_MODEL = "groq-model";
    process.env.OPENROUTER_MODEL = "or-model";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await chatJsonWithHosted({ system: "s", user: "u" });
    expect(result.endpointId).toBe("openrouter");
    expect(result.model).toBe("or-model");
    expect(result.content).toContain("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries next endpoint when validate rejects the model output", async () => {
    clearHostedKeys();
    process.env.HOSTED_AI_CHAIN = "groq,openrouter";
    process.env.GROQ_API_KEY = "g-key";
    process.env.OPENROUTER_API_KEY = "or-key";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "not-json" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await chatJsonWithHosted(
      { system: "s", user: "u" },
      {
        validate: (content) => {
          if (!content.includes("{")) throw new Error("invalid or unsupported");
        },
      },
    );
    expect(result.endpointId).toBe("openrouter");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
