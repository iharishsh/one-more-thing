import { describe, expect, it } from "vitest";
import {
  classifyErrorMessage,
  classifyHttpStatus,
  isRetryableFailure,
} from "@/server/ai/failures";
import { AiRuntimeError } from "@/server/ai/clients";

describe("AI failure classification", () => {
  it("maps HTTP statuses", () => {
    expect(classifyHttpStatus(429)).toBe("rate_limit");
    expect(classifyHttpStatus(408)).toBe("timeout");
    expect(classifyHttpStatus(500)).toBe("unavailable");
  });

  it("maps messages to kinds", () => {
    expect(classifyErrorMessage("request timed out")).toBe("timeout");
    expect(classifyErrorMessage("429 rate limit")).toBe("rate_limit");
    expect(
      classifyErrorMessage("Model returned invalid or unsupported analysis JSON"),
    ).toBe("invalid_json");
    expect(classifyErrorMessage("Model output failed analysis schema validation")).toBe(
      "schema_mismatch",
    );
  });

  it("marks recoverable kinds retryable", () => {
    expect(isRetryableFailure("rate_limit")).toBe(true);
    expect(isRetryableFailure("timeout")).toBe(true);
    expect(isRetryableFailure("invalid_json")).toBe(true);
    expect(isRetryableFailure("schema_mismatch")).toBe(true);
    expect(isRetryableFailure("config")).toBe(false);
    expect(isRetryableFailure("incorrect_interpretation")).toBe(false);
  });

  it("AiRuntimeError carries kind + retryable", () => {
    const err = new AiRuntimeError("too many requests", { status: 429 });
    expect(err.kind).toBe("rate_limit");
    expect(err.retryable).toBe(true);
  });
});
