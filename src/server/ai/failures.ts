/** Structured AI failure taxonomy for retries, logging, and reliability reports. */

export type AiFailureKind =
  | "rate_limit"
  | "timeout"
  | "invalid_json"
  | "schema_mismatch"
  | "incorrect_interpretation"
  | "unavailable"
  | "config";

export function isRetryableFailure(kind: AiFailureKind): boolean {
  return (
    kind === "rate_limit" ||
    kind === "timeout" ||
    kind === "invalid_json" ||
    kind === "schema_mismatch" ||
    kind === "unavailable"
  );
}

export function classifyHttpStatus(status: number): AiFailureKind {
  if (status === 429) return "rate_limit";
  if (status === 408) return "timeout";
  if (status === 401 || status === 402 || status === 403) return "unavailable";
  if (status >= 500) return "unavailable";
  return "unavailable";
}

export function classifyErrorMessage(message: string): AiFailureKind {
  if (/timed out|AbortError/i.test(message)) return "timeout";
  if (/429|rate limit|too many requests/i.test(message)) return "rate_limit";
  if (/invalid or unsupported analysis JSON|JSON\.parse|Unexpected token/i.test(message)) {
    return "invalid_json";
  }
  if (/schema|ZodError|no usable findings/i.test(message)) {
    return "schema_mismatch";
  }
  if (/not configured|AI_PROVIDER|API key/i.test(message)) return "config";
  return "unavailable";
}
