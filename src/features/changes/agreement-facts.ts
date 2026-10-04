/**
 * Agreement facts derived from scope text + project counters.
 * Extraction aids for prompts and revision tracking — not billing classifiers.
 * Generic across professions — no industry keyword lists.
 */

export type AgreementFacts = {
  namedItems: string[];
  exclusionItems: string[];
  revisionRoundsTotal: number | null;
  revisionRoundsUsed: number;
  remainingRevisionRounds: number | null;
};

const BULLET = /^\s*[-*•]\s+(.+)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.+)$/;
const INCLUDES = /\bincludes?\b[:\s]+(.+)/i;
const EXCLUDES =
  /\b(?:excludes?|does not include|do not include|not included|out of scope)\b[:\s]+(.+)/i;

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCountToken(token: string): number | null {
  const lower = token.toLowerCase();
  if (WORD_NUMBERS[lower] != null) return WORD_NUMBERS[lower];
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

function splitList(text: string): string[] {
  return text
    .split(/,|;|\band\b|\bor\b/i)
    .map((part) => part.replace(/\.$/, "").trim())
    .filter((part) => part.length > 2);
}

function extractRevisionTotal(scope: string): number | null {
  const patterns = [
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+revision(?:\s+rounds?)?\b/i,
    /\brevision(?:\s+rounds?)?\s*[:(]?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  ];
  for (const pattern of patterns) {
    const match = scope.match(pattern);
    if (match?.[1]) {
      const n = parseCountToken(match[1]);
      if (n != null) return n;
    }
  }
  return null;
}

export function parseAgreementFacts(input: {
  scope: string;
  revisionRoundsTotal?: number | null;
  revisionRoundsUsed?: number;
}): AgreementFacts {
  const lines = input.scope
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const namedItems: string[] = [];
  const exclusionItems: string[] = [];

  for (const line of lines) {
    const bullet = line.match(BULLET)?.[1] ?? line.match(NUMBERED)?.[1];
    if (bullet) {
      namedItems.push(bullet);
      continue;
    }

    const excl = line.match(EXCLUDES)?.[1];
    if (excl) {
      exclusionItems.push(...splitList(excl));
      continue;
    }

    const incl = line.match(INCLUDES)?.[1];
    if (incl && !/revision/i.test(incl)) {
      namedItems.push(...splitList(incl));
    }
  }

  if (namedItems.length === 0) {
    const withHero = input.scope.match(/\bwith\b\s+([^.]+?)(?:\.|$)/i)?.[1];
    if (withHero) namedItems.push(...splitList(withHero));
  }

  const total =
    input.revisionRoundsTotal != null
      ? input.revisionRoundsTotal
      : extractRevisionTotal(input.scope);
  const used = input.revisionRoundsUsed ?? 0;
  const remaining = total == null ? null : Math.max(0, total - used);

  return {
    namedItems: [...new Set(namedItems)],
    exclusionItems: [...new Set(exclusionItems)],
    revisionRoundsTotal: total,
    revisionRoundsUsed: used,
    remainingRevisionRounds: remaining,
  };
}
