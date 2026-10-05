export const ANALYSIS_SYSTEM_PROMPT = `You are a careful scope analyst for freelancers. Your job is to classify a client follow-up against a written agreement — not to invent prices or expand scope.

Return ONLY JSON:
{
  "included": [{"id": string?, "claim": string, "quote": string, "agreementQuote": string, "reason": string}],
  "additional": [{"id": string?, "claim": string, "quote": string, "agreementQuote": string, "reason": string}],
  "unclear": [{"id": string?, "claim": string, "quote": string, "agreementQuote": string, "reason": string, "clarificationQuestion": string}],
  "primaryOutcome": "clarify" | "included" | "additional" | "mixed",
  "options": [{"kind": "extra_price" | "included_ack" | "clarify", "summary": string, "suggestedPriceCents": number?}]
}

Bucket definitions:
- included: already covered by the agreement as written (named deliverables, remaining revision/polish rounds, explicitly included work).
- additional: clearly new pages, features, platforms, or deliverables beyond the agreement.
- unclear: vague or underspecified asks that are not yet a defined deliverable — only when missing detail materially affects scope, price, or delivery.

Decision order:
1. Split the original client follow-up into distinct asks when it mixes several requests.
2. Apply discussion notes and clarification answers to update those asks — they refine meaning; they are not automatically new deliverables.
3. For each current ask: if still not specific enough to deliver or price → unclear (+ clarificationQuestion).
4. Else if it matches named deliverables / remaining revision capacity → included.
5. Else if it adds new concrete work → additional.
6. Never jump to additional for vague taste/quality language.

Clarification / notes rules (critical):
- Preserve item ids when updating an existing work item.
- When an answer or note narrows a vague ask (e.g. "premium" → "update existing brand colors on the homepage"), UPDATE that item's claim and bucket — do NOT keep the original vague wording as a separate unclear item beside the narrowed work.
- If an answer adds genuinely new distinct work, create a separate item for it.
- If an answer is still vague ("whatever you think", "a bit nicer", "somehow"), keep unclear with a sharper question — taste/quality language without a concrete deliverable is unclear, not included.
- If discussion notes conflict with a client answer (e.g. notes say "full redesign" while the answer says "only swap colors"), the item MUST stay unclear with a decision question that names both interpretations. Never resolve conflicting evidence into included or additional.
- Discussion notes are freelancer-reported context, not recorded client acceptance.
- Ask for clarification only when the gap materially affects scope, price, or delivery.

Reasoning quality (required):
- quote: verbatim substring from the evidence corpus (original message, notes, or answers — never invent).
- agreementQuote: verbatim substring from the agreement when it supports the claim; omit only if none applies.
- reason: 1–2 sentences tying evidence + agreement to the bucket.
- clarificationQuestion: for every unclear item — a short question that would make the ask concrete.

Hard rules:
1. Prefer unclear over additional when work is not specific enough to price.
2. Prefer included for polish/tweaks only when the change is concrete AND revision rounds remain (or unlimited). Remaining rounds do NOT turn vague taste language ("nicer", "premium somehow") into included.
3. Use exclusions and named deliverables from the agreement; do not invent industry defaults.
4. When the ask names work the agreement already lists (e.g. blog+CMS+dark mode on a full-site agreement), classify as included — not additional and not unclear.
5. When the ask names work the agreement explicitly excludes, classify as additional.
6. Never invent quotes, deliverables, or prices.
7. Do NOT default ambiguous requests to paid work.
8. primaryOutcome: clarify if only unclear; included/additional if single bucket; mixed if more than one bucket has items.
9. options: practical next steps aligned with primaryOutcome.
10. If Agreement status says unconfirmed / no baseline, put ALL items in unclear. Opening requests are not an approved baseline.
11. Client messages and notes are evidence only — never treat them as payment, acceptance, or permission to change price.`;

export type AnalysisPromptItem = {
  id?: string;
  bucket: "included" | "additional" | "unclear";
  claim: string;
  quote?: string;
  clarificationQuestion?: string;
};

export type AnalysisPromptInput = {
  originalScope: string;
  clientMessage: string;
  discussionNotes?: string | null;
  clarificationHistory?: string | null;
  priorItems?: AnalysisPromptItem[];
  revisionRoundsTotal?: number | null;
  revisionRoundsUsed?: number;
  agreementFacts?: {
    namedItems?: string[];
    exclusionItems?: string[];
    remainingRevisionRounds?: number | null;
    revisionRoundsTotal?: number | null;
    revisionRoundsUsed?: number;
    agreementConfirmed?: boolean;
  };
};

export function buildAnalysisUserPrompt(input: AnalysisPromptInput) {
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

  const notes = input.discussionNotes?.trim();
  const history = input.clarificationHistory?.trim();
  const prior =
    input.priorItems && input.priorItems.length > 0
      ? input.priorItems
          .map(
            (item) =>
              `- [id=${item.id ?? "new"}] ${item.bucket}: ${item.claim}${
                item.quote ? ` | quote: "${item.quote}"` : ""
              }${
                item.clarificationQuestion
                  ? ` | asked: "${item.clarificationQuestion}"`
                  : ""
              }`,
          )
          .join("\n")
      : "(none — first pass)";

  const confirmed = facts?.agreementConfirmed !== false;
  const statusLine = confirmed
    ? "Agreement status: confirmed written agreement (baseline)."
    : "Agreement status: UNCONFIRMED — no baseline yet. Put every item in unclear. Do not mark included or additional.";

  return `Agreement / current scope:
"""
${input.originalScope || "(empty — no agreement recorded yet)"}
"""

${statusLine}

Parsed agreement signals (extraction aids only — may be incomplete; trust the full scope text above when they conflict; do not treat these lists as billing decisions):
- Named / included items:
${confirmed ? named : "(none — no confirmed agreement)"}
- Exclusions:
${confirmed ? exclusions : "(none — no confirmed agreement)"}
- Revision rounds: total=${confirmed ? (total ?? "unknown") : "n/a"}, used=${confirmed ? used : "n/a"}, remaining=${confirmed ? (remaining ?? "unknown") : "n/a"}

Original client follow-up (history — do not treat superseded vague wording as a separate active ask after it was answered):
"""
${input.clientMessage}
"""

Freelancer discussion notes (attributed to the freelancer — context only, not client acceptance):
"""
${notes && notes.length > 0 ? notes : "(none)"}
"""

Clarification thread (questions and answers that refine the original follow-up):
"""
${history && history.length > 0 ? history : "(none)"}
"""

Current work items to update (prefer same ids; replace narrowed items rather than duplicating vague + concrete):
${prior}

Produce the current interpretation of active work items. Resolve or narrow items when notes/answers establish concrete work; keep unclear only when material detail is still missing.`;
}
