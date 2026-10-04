import { afterEach, describe, expect, it } from "vitest";
import { runAnalysis } from "@/server/ai/provider";
import {
  BLOG_CMS_DARK_MESSAGE,
  FULL_SITE_SCOPE,
  LANDING_SCOPE,
} from "./fixtures/agreements";

const previousProvider = process.env.AI_PROVIDER;
const runLive =
  process.env.RUN_AI_CONTRAST === "1" &&
  (process.env.AI_PROVIDER === "ollama" ||
    process.env.AI_PROVIDER === "hosted");

afterEach(() => {
  if (previousProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = previousProvider;
});

describe("AI agreement contrast", () => {
  it.skipIf(!runLive)(
    "live provider: same request differs across agreements",
    async () => {
      const narrow = await runAnalysis({
        originalScope: LANDING_SCOPE,
        clientMessage: BLOG_CMS_DARK_MESSAGE,
      });
      const broad = await runAnalysis({
        originalScope: FULL_SITE_SCOPE,
        clientMessage: BLOG_CMS_DARK_MESSAGE,
      });

      expect(narrow.primaryOutcome).toBe("additional");
      expect(narrow.additional.length).toBeGreaterThan(0);
      // Full-site agreement already covers blog/CMS/dark mode.
      expect(broad.primaryOutcome).not.toBe("additional");
    },
    120_000,
  );

  it("manual provider: always needs review — never auto-bills from keywords", async () => {
    process.env.AI_PROVIDER = "manual";
    const narrow = await runAnalysis({
      originalScope: LANDING_SCOPE,
      clientMessage: BLOG_CMS_DARK_MESSAGE,
    });
    const broad = await runAnalysis({
      originalScope: FULL_SITE_SCOPE,
      clientMessage: BLOG_CMS_DARK_MESSAGE,
    });
    expect(narrow.source).toBe("manual");
    expect(broad.source).toBe("manual");
    expect(narrow.primaryOutcome).toBe("clarify");
    expect(broad.primaryOutcome).toBe("clarify");
    expect(narrow.additional).toHaveLength(0);
    expect(broad.additional).toHaveLength(0);
    expect(narrow.included).toHaveLength(0);
    expect(broad.included).toHaveLength(0);
  });
});
