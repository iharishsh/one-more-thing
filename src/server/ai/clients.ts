import "server-only";

/** Selected AI provider is missing required configuration — do not fall back silently. */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

/** Provider timed out, was unavailable, or returned unusable output. */
export class AiRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRuntimeError";
  }
}

export type ChatJsonInput = {
  system: string;
  user: string;
  temperature?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function asRuntimeError(error: unknown, prefix: string): AiRuntimeError {
  if (error instanceof AiRuntimeError) return error;
  if (error instanceof AiConfigError) throw error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AiRuntimeError(`${prefix} timed out`);
  }
  const detail = error instanceof Error ? error.message : "Unknown error";
  return new AiRuntimeError(`${prefix}: ${detail}`);
}

export function assertHostedAiConfigured() {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.HOSTED_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiConfigError(
      "AI_PROVIDER=hosted requires OPENAI_API_KEY or HOSTED_AI_API_KEY",
    );
  }
  return apiKey;
}

/** Shared Ollama chat transport — task prompts stay with callers. */
export async function chatJsonWithOllama(
  input: ChatJsonInput,
): Promise<string> {
  const baseUrl = (
    process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
  ).replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";
  const timeout = withTimeout(DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeout.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        options: { temperature: input.temperature ?? 0.2 },
      }),
    });

    if (!response.ok) {
      throw new AiRuntimeError(
        `Ollama error ${response.status}: ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as {
      message?: { content?: string };
    };
    const content = payload.message?.content?.trim();
    if (!content) {
      throw new AiRuntimeError("Ollama returned empty content");
    }
    return content;
  } catch (error) {
    throw asRuntimeError(error, "Ollama request failed");
  } finally {
    timeout.clear();
  }
}

/** Shared OpenAI-compatible hosted chat transport — task prompts stay with callers. */
export async function chatJsonWithHosted(
  input: ChatJsonInput,
): Promise<string> {
  const apiKey = assertHostedAiConfigured();
  const baseUrl = (
    process.env.HOSTED_AI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.HOSTED_AI_MODEL ?? "gpt-4o-mini";
  const timeout = withTimeout(DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });

    if (!response.ok) {
      throw new AiRuntimeError(
        `Hosted AI error ${response.status}: ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AiRuntimeError("Hosted AI returned empty content");
    }
    return content;
  } catch (error) {
    if (error instanceof AiConfigError) throw error;
    throw asRuntimeError(error, "Hosted AI request failed");
  } finally {
    timeout.clear();
  }
}
