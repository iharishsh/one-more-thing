import type { AnalysisResult, Finding } from "@/features/changes/analysis.schema";

export function isClassificationFinding(item: Finding): boolean {
  if (item.reviewKind === "classification") return true;
  if (item.reviewKind === "missing_info") return false;
  return /needs manual review|automatic keyword|no automatic billing|couldn’t auto-sort|decide manually|use the menu to say/i.test(
    `${item.claim} ${item.reason}`,
  );
}

export function classificationCount(analysis: AnalysisResult): number {
  return analysis.unclear.filter(isClassificationFinding).length;
}

export function missingInfoCount(analysis: AnalysisResult): number {
  return analysis.unclear.filter((item) => !isClassificationFinding(item))
    .length;
}

/** Prefer clarified claim over raw client paste for list titles. */
export function shortRequestTitle(
  analysis: AnalysisResult | null | undefined,
  clientMessage: string,
  max = 72,
): string {
  const preferred =
    analysis?.included[0]?.claim ||
    analysis?.additional[0]?.claim ||
    analysis?.unclear.find((item) => !isClassificationFinding(item))?.claim ||
    analysis?.unclear.find((item) => !/^needs manual review$/i.test(item.claim))
      ?.claim ||
    clientMessage;
  const one = preferred.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

export function analysisStatusLabel(analysis: AnalysisResult): {
  label: string;
  tone: "default" | "warning" | "paid" | "muted" | "clarify" | "included" | "additional";
  actionLabel: string;
} {
  if (analysis.freelancerDecision?.kind === "included") {
    // Internal included decision must not hide remaining additional work.
    if (analysis.additional.length > 0) {
      return {
        label: "New work still open",
        tone: "additional",
        actionLabel: "Set a price",
      };
    }
    return {
      label: "Marked as covered",
      tone: "included",
      actionLabel: "Share confirmation",
    };
  }

  const classN = classificationCount(analysis);
  const missingN = missingInfoCount(analysis);

  if (classN > 0 && missingN === 0 && analysis.included.length === 0 && analysis.additional.length === 0) {
    return {
      label: "Decide what this is",
      tone: "clarify",
      actionLabel: "Review request",
    };
  }
  if (missingN > 0) {
    return {
      label: "Need more info",
      tone: "clarify",
      actionLabel: "Add notes",
    };
  }
  if (analysis.primaryOutcome === "included") {
    return {
      label: "Looks covered",
      tone: "included",
      actionLabel: "Mark as covered",
    };
  }
  if (analysis.primaryOutcome === "additional") {
    return {
      label: "Looks like new work",
      tone: "additional",
      actionLabel: "Set a price",
    };
  }
  if (analysis.primaryOutcome === "mixed") {
    return {
      label: "Mixed request",
      tone: "default",
      actionLabel: "Review request",
    };
  }
  return {
    label: "Needs a look",
    tone: "muted",
    actionLabel: "Review request",
  };
}
