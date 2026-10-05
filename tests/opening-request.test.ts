import { describe, expect, it } from "vitest";
import { cleanOpeningRequest } from "@/features/changes/opening-request";

describe("cleanOpeningRequest", () => {
  it("returns clean text unchanged", () => {
    expect(cleanOpeningRequest("Need an iOS app")).toBe("Need an iOS app");
  });

  it("strips legacy provisional instruction prose", () => {
    const raw = `PROVISIONAL AGREEMENT — not yet confirmed with the client

This is draft intake only. Proposed work below is not approved scope.

Do not classify follow-ups as included until the agreement is confirmed.

Client's opening request (proposed work, not approved scope):
Can you just brighten a few portraits in the gallery before we share with family?

Agreement details to be confirmed with the client.`;
    expect(cleanOpeningRequest(raw)).toBe(
      "Can you just brighten a few portraits in the gallery before we share with family?",
    );
  });
});
