/**
 * Extract the client's opening ask from legacy provisional prose.
 * New projects store a clean openingRequest without workflow instructions.
 */
export function cleanOpeningRequest(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";

  if (!/PROVISIONAL AGREEMENT|draft intake only|Do not classify/i.test(text)) {
    return text;
  }

  const labeled = text.match(
    /Client'?s opening request[^:]*:\s*([\s\S]*?)(?:\n\nAgreement details|\n\nWhat.?s included|$)/i,
  );
  if (labeled?.[1]?.trim()) return labeled[1].trim();

  // Fall back: drop known instruction lines, keep the rest.
  const kept = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/PROVISIONAL AGREEMENT/i.test(line) &&
        !/draft intake only/i.test(line) &&
        !/Do not classify|Don.?t treat follow-ups/i.test(line) &&
        !/Client'?s opening request/i.test(line) &&
        !/Agreement details to be confirmed/i.test(line) &&
        !/What.?s included still needs/i.test(line) &&
        !/Intake notes \(unconfirmed\)/i.test(line),
    );
  return kept.join("\n").trim();
}
