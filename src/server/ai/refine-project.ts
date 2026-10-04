import "server-only";

import {
  refineProjectDraftResultSchema,
  type RefineProjectDraftInput,
  type RefineProjectDraftResult,
} from "@/features/projects/project.schema";
import {
  PROJECT_REFINE_SYSTEM_PROMPT,
  buildProjectRefineUserPrompt,
} from "@/features/projects/project-refine.prompt";
import {
  AiConfigError,
  AiRuntimeError,
  assertHostedAiConfigured,
  chatJsonWithHosted,
  chatJsonWithOllama,
} from "@/server/ai/clients";
import { extractJsonObject } from "@/server/ai/evidence";

function linesToDeliverables(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** Deterministic refine for demos / AI fallback — structures notes without inventing work. */
export function refineProjectDraftManual(
  input: RefineProjectDraftInput,
): RefineProjectDraftResult {
  const title =
    input.title.trim() ||
    input.originalScope
      .split(/[.!?\n]/)
      .map((s) => s.trim())
      .find(Boolean)
      ?.slice(0, 60) ||
    "Untitled project";

  const fromField = linesToDeliverables(input.deliverablesText);
  const fromScope = linesToDeliverables(
    (input.originalScope.match(
      /(?:deliverables?|includes?)[:\s]*([\s\S]*?)(?=\n\n|revision|exclu|$)/i,
    )?.[1] ??
      "") ||
      "",
  );
  const deliverables =
    fromField.length > 0
      ? fromField
      : fromScope.length > 0
        ? fromScope
        : linesToDeliverables(input.originalScope).slice(0, 5);

  const hasRevisions = /\brevision/i.test(input.originalScope);
  const hasExclusions = /\b(does not include|exclud|out of scope|not include)/i.test(
    input.originalScope,
  );

  const scopeBody = input.originalScope.trim() || title;
  const sections = [
    "What's included",
    scopeBody,
    "",
    "Deliverables",
    deliverables.length > 0
      ? deliverables.map((d) => `- ${d}`).join("\n")
      : "- (Add concrete deliverables)",
  ];

  if (hasRevisions) {
    sections.push(
      "",
      "Revision rounds",
      scopeBody.match(/[^.]*revision[^.]*\.?/i)?.[0]?.trim() || "As noted above.",
    );
  } else {
    sections.push(
      "",
      "Revision rounds",
      "Not specified — add how many revision rounds are included.",
    );
  }

  if (hasExclusions) {
    const exclu =
      scopeBody.match(
        /(?:does not include|exclusions?|out of scope)[:\s]*([\s\S]*?)(?=\n\n|$)/i,
      )?.[0] ?? "As noted above.";
    sections.push("", "Exclusions", exclu.trim());
  } else {
    sections.push(
      "",
      "Exclusions",
      "Not specified — list what is out of scope.",
    );
  }

  const gaps: string[] = [];
  if (!input.originalScope.trim()) {
    gaps.push("Add what was already agreed with the client.");
  }
  if (!hasRevisions) gaps.push("Confirm revision rounds.");
  if (!hasExclusions) gaps.push("Confirm exclusions.");
  if (deliverables.length === 0) gaps.push("List concrete deliverables.");

  return refineProjectDraftResultSchema.parse({
    title,
    originalScope: sections.join("\n").trim(),
    deliverables,
    notes: gaps.length > 0 ? `Still check: ${gaps.join(" ")}` : undefined,
  });
}

async function refineWithOllama(
  input: RefineProjectDraftInput,
): Promise<RefineProjectDraftResult> {
  const content = await chatJsonWithOllama({
    system: PROJECT_REFINE_SYSTEM_PROMPT,
    user: buildProjectRefineUserPrompt(input),
    temperature: 0.3,
  });
  try {
    return refineProjectDraftResultSchema.parse(extractJsonObject(content));
  } catch {
    throw new AiRuntimeError(
      "Model returned invalid or unsupported refine JSON",
    );
  }
}

async function refineWithHosted(
  input: RefineProjectDraftInput,
): Promise<RefineProjectDraftResult> {
  const { content } = await chatJsonWithHosted(
    {
      system: PROJECT_REFINE_SYSTEM_PROMPT,
      user: buildProjectRefineUserPrompt(input),
      temperature: 0.3,
    },
    {
      validate: (raw) => {
        try {
          refineProjectDraftResultSchema.parse(extractJsonObject(raw));
        } catch {
          throw new AiRuntimeError(
            "Model returned invalid or unsupported refine JSON",
          );
        }
      },
    },
  );
  return refineProjectDraftResultSchema.parse(extractJsonObject(content));
}

export async function runProjectRefine(
  input: RefineProjectDraftInput,
): Promise<RefineProjectDraftResult & { source: "ai" | "manual" | "fallback" }> {
  const configured = process.env.AI_PROVIDER ?? "manual";
  const hasSeed =
    input.title.trim().length >= 2 ||
    input.originalScope.trim().length >= 12 ||
    input.deliverablesText.trim().length >= 2;

  if (!hasSeed) {
    throw new Error(
      "Add a title or a few scope notes first — AI refine needs something to work from.",
    );
  }

  if (configured === "manual") {
    return { ...refineProjectDraftManual(input), source: "manual" };
  }

  if (configured === "hosted") {
    assertHostedAiConfigured();
  } else if (configured !== "ollama") {
    throw new AiConfigError(
      `Unknown AI_PROVIDER "${configured}". Use manual, ollama, or hosted.`,
    );
  }

  try {
    if (configured === "ollama") {
      return { ...(await refineWithOllama(input)), source: "ai" };
    }
    return { ...(await refineWithHosted(input)), source: "ai" };
  } catch (error) {
    if (error instanceof AiConfigError) throw error;
    console.warn(
      "[ai] Project refine unavailable, using structured manual fallback:",
      error,
    );
    return { ...refineProjectDraftManual(input), source: "fallback" };
  }
}
