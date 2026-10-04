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

export type HostedEndpoint = {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type HostedChatResult = {
  content: string;
  endpointId: string;
  model: string;
};

const DEFAULT_TIMEOUT_MS = 60_000;

type HostedPreset = {
  id: string;
  defaultBaseUrl: string;
  keyEnv: string[];
  baseUrlEnv?: string[];
  modelEnv: string[];
  defaultModel: string;
};

/** Named OpenAI-compatible backends. Order in HOSTED_AI_CHAIN controls failover. */
const HOSTED_PRESETS: HostedPreset[] = [
  {
    id: "groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    keyEnv: ["GROQ_API_KEY"],
    baseUrlEnv: ["GROQ_BASE_URL"],
    modelEnv: ["GROQ_MODEL"],
    defaultModel: "openai/gpt-oss-20b",
  },
  {
    id: "openrouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    keyEnv: ["OPENROUTER_API_KEY"],
    baseUrlEnv: ["OPENROUTER_BASE_URL"],
    modelEnv: ["OPENROUTER_MODEL"],
    defaultModel: "openrouter/free",
  },
  {
    id: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyEnv: ["OPENAI_API_KEY"],
    baseUrlEnv: ["OPENAI_BASE_URL"],
    modelEnv: ["OPENAI_MODEL", "HOSTED_AI_MODEL"],
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "custom",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyEnv: ["HOSTED_AI_API_KEY"],
    baseUrlEnv: ["HOSTED_AI_BASE_URL"],
    modelEnv: ["HOSTED_AI_MODEL"],
    defaultModel: "gpt-4o-mini",
  },
];

function envFirst(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

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

function parseHostedChain(): string[] {
  const raw = process.env.HOSTED_AI_CHAIN?.trim();
  if (!raw) return HOSTED_PRESETS.map((p) => p.id);
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function endpointFromPreset(preset: HostedPreset): HostedEndpoint | null {
  const apiKey = envFirst(preset.keyEnv);
  if (!apiKey) return null;
  const baseUrl = (
    envFirst(preset.baseUrlEnv ?? []) ?? preset.defaultBaseUrl
  ).replace(/\/$/, "");
  const model = envFirst(preset.modelEnv) ?? preset.defaultModel;
  return { id: preset.id, baseUrl, apiKey, model };
}

/** Endpoints that have an API key, in HOSTED_AI_CHAIN order. */
export function resolveHostedEndpoints(): HostedEndpoint[] {
  const byId = new Map(HOSTED_PRESETS.map((p) => [p.id, p]));
  const chain = parseHostedChain();
  const resolved: HostedEndpoint[] = [];
  const seen = new Set<string>();

  for (const id of chain) {
    if (seen.has(id)) continue;
    seen.add(id);
    const preset = byId.get(id);
    if (!preset) {
      console.warn(`[ai] Unknown HOSTED_AI_CHAIN entry "${id}" — skipped`);
      continue;
    }
    const endpoint = endpointFromPreset(preset);
    if (endpoint) resolved.push(endpoint);
  }

  return resolved;
}

export function assertHostedAiConfigured(): HostedEndpoint[] {
  const endpoints = resolveHostedEndpoints();
  if (endpoints.length === 0) {
    throw new AiConfigError(
      "AI_PROVIDER=hosted requires at least one API key (GROQ_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, or HOSTED_AI_API_KEY). Set HOSTED_AI_CHAIN to order failover (default: groq,openrouter,openai,custom).",
    );
  }
  return endpoints;
}

function shouldFailoverStatus(status: number): boolean {
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

async function chatCompletionsOnce(
  endpoint: HostedEndpoint,
  input: ChatJsonInput,
  useJsonObjectFormat: boolean,
): Promise<string> {
  const timeout = withTimeout(DEFAULT_TIMEOUT_MS);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${endpoint.apiKey}`,
  };
  if (endpoint.id === "openrouter") {
    const referer = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (referer) headers["HTTP-Referer"] = referer;
    headers["X-Title"] = "One More Thing";
  }

  const body: Record<string, unknown> = {
    model: endpoint.model,
    temperature: input.temperature ?? 0.2,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  };
  if (useJsonObjectFormat) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal: timeout.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new AiRuntimeError(
        `${endpoint.id} error ${response.status}: ${text}`,
      );
      (error as AiRuntimeError & { status?: number }).status = response.status;
      throw error;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AiRuntimeError(`${endpoint.id} returned empty content`);
    }
    return content;
  } catch (error) {
    throw asRuntimeError(error, `${endpoint.id} request failed`);
  } finally {
    timeout.clear();
  }
}

async function chatWithEndpoint(
  endpoint: HostedEndpoint,
  input: ChatJsonInput,
): Promise<string> {
  try {
    return await chatCompletionsOnce(endpoint, input, true);
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : "";
    // Some free models reject response_format — retry once without it.
    if (
      status === 400 &&
      /response_format|json_object|json mode/i.test(message)
    ) {
      return chatCompletionsOnce(endpoint, input, false);
    }
    throw error;
  }
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

export type HostedChatOptions = {
  /** If this throws, the gateway tries the next endpoint (bad JSON, unusable findings, etc.). */
  validate?: (content: string) => void;
};

/**
 * OpenAI-compatible hosted gateway.
 * Tries each configured endpoint in HOSTED_AI_CHAIN order until one succeeds
 * (skips keys that are out of credits / rate-limited / unavailable).
 */
export async function chatJsonWithHosted(
  input: ChatJsonInput,
  options?: HostedChatOptions,
): Promise<HostedChatResult> {
  const endpoints = assertHostedAiConfigured();
  const failures: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const content = await chatWithEndpoint(endpoint, input);
      options?.validate?.(content);
      if (failures.length > 0) {
        console.warn(
          `[ai] Hosted gateway used ${endpoint.id} after failures: ${failures.join(" | ")}`,
        );
      }
      return { content, endpointId: endpoint.id, model: endpoint.model };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown hosted error";
      const status = (error as { status?: number }).status;
      failures.push(`${endpoint.id}: ${detail}`);
      console.warn(`[ai] Hosted endpoint ${endpoint.id} failed:`, detail);

      const tryNext =
        status == null ||
        shouldFailoverStatus(status) ||
        status === 400 ||
        /empty content|timed out|fetch failed|network|invalid or unsupported|no usable findings/i.test(
          detail,
        );

      if (!tryNext) {
        throw error instanceof AiRuntimeError
          ? error
          : new AiRuntimeError(detail);
      }
    }
  }

  throw new AiRuntimeError(
    `All hosted AI endpoints failed (${failures.join(" | ")})`,
  );
}
