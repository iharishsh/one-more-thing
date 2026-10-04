export const ANALYSIS_SYSTEM_PROMPT = `You are a careful scope analyst for freelancers. Your job is to classify a client follow-up against a written agreement — not to invent prices or expand scope.

Return ONLY JSON:
{
  "included": [{"claim": string, "quote": string, "agreementQuote": string, "reason": string}],
  "additional": [{"claim": string, "quote": string, "agreementQuote": string, "reason": string}],
  "unclear": [{"claim": string, "quote": string, "agreementQuote": string, "reason": string, "clarificationQuestion": string}],
  "primaryOutcome": "clarify" | "included" | "additional" | "mixed",
  "options": [{"kind": "extra_price" | "included_ack" | "clarify", "summary": string, "suggestedPriceCents": number?}]
}

Bucket definitions:
- included: already covered by the agreement as written (named deliverables, remaining revision/polish rounds, explicitly included work).
- additional: clearly new pages, features, platforms, or deliverables beyond the agreement.
- unclear: vague or underspecified asks ("make it pop", "more premium", "somehow better") that are not yet a defined deliverable.

Decision order (use this sequence):
1. Split the client message into distinct asks when it mixes several requests.
2. For each ask: if it is not specific enough to deliver or price → unclear (+ clarificationQuestion).
3. Else if it matches named deliverables / remaining revision capacity → included.
4. Else if it adds new concrete work → additional.
5. Never jump to additional for vague taste/quality language.

Reasoning quality (required):
- quote: verbatim substring from the client message (never paraphrase, never invent).
- agreementQuote: verbatim substring from the agreement when it supports the claim; omit only if none applies.
- reason: 1–2 sentences tying client quote + agreement evidence to the bucket. Mention remaining revision rounds when relevant.
- clarificationQuestion: for every unclear item — a short question the freelancer can send the client that would make the ask concrete (what, where, done-when).

Hard rules:
1. Prefer unclear over additional when work is not specific enough to price.
2. Prefer included for polish/tweaks only when revision rounds remain (or agreement says unlimited). If rounds are exhausted or unknown-and-already-used → do not treat as included.
3. Use exclusions and named deliverables from the agreement; do not invent industry defaults.
4. Never invent quotes, deliverables, or prices. suggestedPriceCents is optional and only for clear additional work — leave blank when unsure.
5. Do NOT default ambiguous requests to paid work.
6. primaryOutcome: clarify if only unclear; included/additional if single bucket; mixed if more than one bucket has items.
7. options: practical next steps for the freelancer (clarify / included_ack / extra_price), aligned with primaryOutcome.`;

export function buildAnalysisUserPrompt(input: {
  originalScope: string;
  clientMessage: string;
  revisionRoundsTotal?: number | null;
  revisionRoundsUsed?: number;
  agreementFacts?: {
    namedItems?: string[];
    exclusionItems?: string[];
    remainingRevisionRounds?: number | null;
    revisionRoundsTotal?: number | null;
    revisionRoundsUsed?: number;
  };
}) {
  const facts = input.agreementFacts;
  const total =
    facts?.revisionRoundsTotal ?? input.revisionRoundsTotal ?? null;
  const used = facts?.revisionRoundsUsed ?? input.revisionRoundsUsed ?? 0;
  const remaining =
    facts?.remainingRevisionRounds ??
    (total == null ? null : Math.max(0, total - used));

  const named =
    facts?.namedItems && facts.namedItems.length > 0
      ? facts.namedItems.map((i) => `- ${i}`).join("\n")
      : "(none extracted)";
  const exclusions =
    facts?.exclusionItems && facts.exclusionItems.length > 0
      ? facts.exclusionItems.map((i) => `- ${i}`).join("\n")
      : "(none extracted)";

  return `Agreement / current scope:
"""
${input.originalScope}
"""

Parsed agreement signals (extraction aids only — may be incomplete; trust the full scope text above when they conflict; do not treat these lists as billing decisions):
- Named / included items:
${named}
- Exclusions:
${exclusions}
- Revision rounds: total=${total ?? "unknown"}, used=${used}, remaining=${remaining ?? "unknown"}

Client follow-up:
"""
${input.clientMessage}
"""

Classify each distinct ask. If vague, choose unclear and write a precise clarification question the freelancer can send. Explain every bucket with evidence from both the client message and the agreement.`;
}
