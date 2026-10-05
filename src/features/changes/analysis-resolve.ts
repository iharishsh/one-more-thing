import {
  derivePrimaryOutcome,
  ensureFindingIds,
  type AnalysisResult,
  type Finding,
} from "@/features/changes/analysis.schema";

function norm(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function claimOverlap(a: string, b: string) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function mentions(haystack: string, needle: string) {
  const h = norm(haystack);
  const n = norm(needle);
  if (!h || !n || n.length < 4) return false;
  return h.includes(n);
}

/** Taste/quality language without an executable change — must stay unclear. */
const VAGUE_TASTE =
  /\b(nicer|prettier|better looking|look better|feel more|more premium|premium somehow|somehow|polish it|improve (the )?(look|feel|vibe|design)|a bit nicer|make it (nicer|better|prettier|cleaner)|more modern)\b/i;

/** Signals that the ask is specific enough to deliver or price. */
const CONCRETE_CHANGE =
  /\b(brighten|retouch|color|colour|spacing|padding|margin|typography|font|hero|button|swap|replace|add |added|new |dark mode|blog|cms|seo|print|drone|ios|android|push|notification|packaging|implement|redesign|photography|gallery|dashboard card|brand colors?)\b/i;

function isVagueTasteOnly(item: Finding): boolean {
  const text = `${item.claim} ${item.quote}`;
  if (!VAGUE_TASTE.test(text)) return false;
  if (CONCRETE_CHANGE.test(text)) return false;
  return true;
}

/** Notes vs answers that describe incompatible scopes of work. */
export function hasConflictingEvidence(input: {
  discussionNotes?: string | null;
  clarificationHistory?: string | null;
}): boolean {
  const notes = input.discussionNotes?.trim() ?? "";
  const history = input.clarificationHistory?.trim() ?? "";
  if (!notes || !history) return false;
  const blob = `${notes}\n${history}`;
  if (/\bconflict(?:ing|s)?\b/i.test(blob)) return true;
  const expansive =
    /\b(full (homepage )?redesign|new photography|large new deliverable)\b/i;
  const narrow =
    /\b(only (swap|update)|nothing else|no redesign)\b/i;
  return expansive.test(notes) && narrow.test(history);
}

/** Force clarify when notes and answers describe incompatible scopes. */
export function demoteAllToUnclearForConflict(
  analysis: AnalysisResult,
): AnalysisResult {
  const reason =
    "Discussion notes and the client answer describe conflicting scope — confirm which interpretation wins before classifying.";
  const clarificationQuestion =
    "Which should we follow: the earlier redesign ask, or the later narrow color-only answer?";
  const withIds = ensureFindingIds(analysis);
  const unclear = [
    ...withIds.unclear,
    ...withIds.included.map((item) => ({
      ...item,
      reason,
      clarificationQuestion: item.clarificationQuestion ?? clarificationQuestion,
    })),
    ...withIds.additional.map((item) => ({
      ...item,
      reason,
      clarificationQuestion: item.clarificationQuestion ?? clarificationQuestion,
    })),
  ];
  const next = { ...withIds, included: [], additional: [], unclear };
  return { ...next, primaryOutcome: derivePrimaryOutcome(next) };
}

/**
 * Deterministic guard: vague taste/quality asks must not land as included
 * just because revision rounds remain. Prompt guidance alone is insufficient.
 * When notes/answers already supply a concrete change, keep the classification.
 */
export function demoteVagueTasteLanguage(
  analysis: AnalysisResult,
  relatedText?: string | null,
): AnalysisResult {
  const relatedConcrete =
    Boolean(relatedText?.trim()) && CONCRETE_CHANGE.test(relatedText!);
  const withIds = ensureFindingIds(analysis);
  const unclear = [...withIds.unclear];
  const included: Finding[] = [];
  const additional: Finding[] = [];

  for (const item of withIds.included) {
    if (isVagueTasteOnly(item) && !relatedConcrete) {
      unclear.push({
        ...item,
        reason:
          "Taste/quality language without a concrete change — ask what specifically should change before treating as included polish.",
        clarificationQuestion:
          item.clarificationQuestion ??
          "What specifically should change (for example colors, spacing, or a particular element)?",
      });
    } else {
      included.push(item);
    }
  }
  for (const item of withIds.additional) {
    if (isVagueTasteOnly(item) && !relatedConcrete) {
      unclear.push({
        ...item,
        reason:
          "Taste/quality language without a concrete deliverable — clarify before pricing as new work.",
        clarificationQuestion:
          item.clarificationQuestion ??
          "What specifically should change so this can be scoped and priced?",
      });
    } else {
      additional.push(item);
    }
  }

  const next = { ...withIds, included, additional, unclear };
  return {
    ...next,
    primaryOutcome: derivePrimaryOutcome(next),
  };
}

/**
 * After a linked answer/notes reassessment: drop residual unclear items that
 * merely restate asks the answer already narrowed into included/additional.
 * Does NOT clear uncertainty just because an answer arrived — only removes
 * related vague items when concrete work quotes/uses that answer or notes.
 */
export function reconcileAnsweredItems(
  analysis: AnalysisResult,
  related: { itemIds?: string[]; claims?: string[]; answerText?: string },
): AnalysisResult {
  const withIds = ensureFindingIds(analysis);
  const relatedIds = new Set(related.itemIds?.filter(Boolean) ?? []);
  const relatedClaims = (related.claims ?? []).map(norm).filter(Boolean);
  const answerText = related.answerText?.trim() ?? "";

  const concrete = [...withIds.included, ...withIds.additional];
  if (
    concrete.length === 0 ||
    (relatedIds.size === 0 && relatedClaims.length === 0 && !answerText)
  ) {
    return withIds;
  }

  const unclear = withIds.unclear.filter((item) => {
    const matchesRelated =
      (item.id != null && relatedIds.has(item.id)) ||
      relatedClaims.some(
        (claim) =>
          claimOverlap(item.claim, claim) || claimOverlap(item.quote, claim),
      );
    if (!matchesRelated) return true;

    const hasSuccessor = concrete.some((c) => {
      if (item.id && c.id === item.id) return true;
      if (answerText) {
        if (
          mentions(c.quote, answerText) ||
          mentions(answerText, c.quote) ||
          mentions(c.claim, answerText) ||
          mentions(answerText, c.claim)
        ) {
          return true;
        }
        // Significant shared tokens between concrete claim and answer
        const tokens = norm(answerText)
          .split(" ")
          .filter((t) => t.length > 4);
        const hit = tokens.filter(
          (t) => norm(c.claim).includes(t) || norm(c.quote).includes(t),
        ).length;
        if (hit >= 2) return true;
      }
      return false;
    });

    // Related vague ask with a concrete successor from the answer → drop duplicate.
    if (hasSuccessor) return false;
    return true;
  });

  const next = { ...withIds, unclear };
  return {
    ...next,
    primaryOutcome: derivePrimaryOutcome(next),
  };
}

/** Build prior-item list for prompts from an analysis snapshot. */
export function priorItemsFromAnalysis(analysis: AnalysisResult | null | undefined) {
  if (!analysis) return [];
  const stamped = ensureFindingIds(analysis);
  return [
    ...stamped.included.map((item) => ({
      id: item.id,
      bucket: "included" as const,
      claim: item.claim,
      quote: item.quote,
    })),
    ...stamped.additional.map((item) => ({
      id: item.id,
      bucket: "additional" as const,
      claim: item.claim,
      quote: item.quote,
    })),
    ...stamped.unclear.map((item) => ({
      id: item.id,
      bucket: "unclear" as const,
      claim: item.claim,
      quote: item.quote,
      clarificationQuestion: item.clarificationQuestion,
    })),
  ];
}

export function formatClarificationHistory(
  messages: Array<{ kind: string; body: string }>,
) {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.kind === "CLARIFICATION_QUESTION") {
      lines.push(`Question to client: ${message.body}`);
    } else if (message.kind === "CLIENT_ANSWER") {
      lines.push(`Client answer: ${message.body}`);
    } else if (message.kind === "FREELANCER_NOTE") {
      lines.push(`Freelancer note (not acceptance): ${message.body}`);
    }
  }
  return lines.join("\n");
}

export function evidenceCorpus(input: {
  clientMessage: string;
  discussionNotes?: string | null;
  clarificationHistory?: string | null;
}) {
  return [
    input.clientMessage,
    input.discussionNotes?.trim(),
    input.clarificationHistory?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Prefer preserving prior ids when the model omits them but claims match. */
export function inheritFindingIds(
  prior: AnalysisResult | null | undefined,
  next: AnalysisResult,
): AnalysisResult {
  if (!prior) return ensureFindingIds(next);
  const priorAll: Finding[] = [
    ...prior.included,
    ...prior.additional,
    ...prior.unclear,
  ];
  const used = new Set<string>();

  const adopt = (item: Finding): Finding => {
    if (item.id?.trim()) {
      used.add(item.id);
      return item;
    }
    const match = priorAll.find(
      (p) =>
        p.id &&
        !used.has(p.id) &&
        (claimOverlap(p.claim, item.claim) || claimOverlap(p.quote, item.quote)),
    );
    if (match?.id) {
      used.add(match.id);
      return { ...item, id: match.id };
    }
    return item;
  };

  return ensureFindingIds({
    ...next,
    included: next.included.map(adopt),
    additional: next.additional.map(adopt),
    unclear: next.unclear.map(adopt),
  });
}
