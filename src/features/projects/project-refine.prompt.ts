export const PROJECT_REFINE_SYSTEM_PROMPT = `You help freelancers turn rough notes into a clear client agreement draft.

Return ONLY JSON:
{
  "title": string,
  "originalScope": string,
  "deliverables": string[],
  "notes": string?
}

Rules:
1. Preserve the freelancer's intent. Do not invent pages, features, tech stacks, or prices they did not mention.
2. originalScope MUST be plain text with these section headings when relevant:
   - What's included
   - Deliverables
   - Revision rounds (only if mentioned or clearly implied; otherwise omit or say "Not specified")
   - Exclusions (only if mentioned or clearly implied; otherwise omit)
3. Make vague notes clearer and more specific without adding scope.
4. deliverables: short concrete item titles, one outcome each (max 12). Prefer extracting from the notes over inventing.
5. title: concise project name (max ~60 chars).
6. notes: optional short tip for the freelancer about what is still missing (e.g. revision count, exclusions).
7. Never invent prices, timelines, or stack choices.
8. If input is too thin, still return structured output but put gaps in notes — do not fabricate a full fake project.`;

export function buildProjectRefineUserPrompt(input: {
  title: string;
  originalScope: string;
  deliverablesText: string;
}) {
  return `Rough project draft from the freelancer:

Title:
"""
${input.title || "(empty)"}
"""

Scope / notes:
"""
${input.originalScope || "(empty)"}
"""

Deliverables (optional, one per line):
"""
${input.deliverablesText || "(empty)"}
"""

Rewrite into a clear agreement draft the freelancer can edit before saving.`;
}
