import { describe, expect, it, beforeEach } from "vitest";
import {
  isCsrfExemptPath,
  verifyMutationOrigin,
} from "@/server/security/origin";
import {
  checkRateLimit,
  rateLimitBucketForPath,
  resetRateLimitStoreForTests,
} from "@/server/security/rate-limit";

describe("CSRF origin verification", () => {
  it("accepts localhost Origin for mutations", () => {
    const headers = new Headers({
      origin: "http://localhost:3000",
    });
    expect(verifyMutationOrigin(headers)).toBe(true);
  });

  it("rejects unknown cross-site Origin", () => {
    const headers = new Headers({
      origin: "https://evil.example",
    });
    expect(verifyMutationOrigin(headers)).toBe(false);
  });

  it("accepts same-origin when Origin is omitted", () => {
    const headers = new Headers({
      "sec-fetch-site": "same-origin",
    });
    expect(verifyMutationOrigin(headers)).toBe(true);
  });

  it("exempts PayPal webhook path", () => {
    expect(isCsrfExemptPath("/api/paypal/webhook")).toBe(true);
    expect(isCsrfExemptPath("/api/paypal/orders")).toBe(false);
  });
});

describe("API rate limits", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
  });

  it("classifies AI-heavy paths", () => {
    expect(rateLimitBucketForPath("/api/changes/x/prepare")).toBe("ai");
    expect(rateLimitBucketForPath("/api/auth/demo-login")).toBe("auth");
    expect(rateLimitBucketForPath("/api/projects")).toBe("api");
  });

  it("blocks after the configured window budget", () => {
    const key = "test-ip";
    let last = checkRateLimit(key, "auth");
    expect(last.ok).toBe(true);
    for (let i = 0; i < 25; i++) {
      last = checkRateLimit(key, "auth");
    }
    expect(last.ok).toBe(false);
    if (!last.ok) {
      expect(last.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
