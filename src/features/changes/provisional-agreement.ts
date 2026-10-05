import {
  analysisSchema,
  derivePrimaryOutcome,
  ensureFindingIds,
  type AnalysisResult,
  type Finding,
} from "@/features/changes/analysis.schema";

/**
 * @deprecated Legacy prose marker. Prefer Project.agreementStatus === UNCONFIRMED.
 * Kept only so older rows / tests can still be detected until fully migrated.
 */
export const PROVISIONAL_AGREEMENT_MARKER =
  "PROVISIONAL AGREEMENT — not yet confirmed with the client";

export type AgreementStatusValue =
  | "UNCONFIRMED"
  | "FREELANCER_RECORDED"
  | "CLIENT_ACCEPTED";

export function isAgreementUnconfirmed(input: {
  agreementStatus?: AgreementStatusValue | string | null;
  currentScope?: string | null;
}): boolean {
  if (input.agreementStatus === "UNCONFIRMED") return true;
  if (input.agreementStatus === "FREELANCER_RECORDED") return false;
  if (input.agreementStatus === "CLIENT_ACCEPTED") return false;
  // Legacy fallback for rows not yet migrated in memory/tests.
  return Boolean(
    input.currentScope &&
      input.currentScope.includes(PROVISIONAL_AGREEMENT_MARKER),
  );
}

/** @deprecated Use isAgreementUnconfirmed({ agreementStatus, currentScope }). */
export function isProvisionalAgreement(scope: string): boolean {
  return scope.includes(PROVISIONAL_AGREEMENT_MARKER);
}

/**
 * @deprecated Do not embed workflow instructions in agreement text.
 * New unconfirmed projects store openingRequest + agreementStatus instead.
 */
export function buildProvisionalScope(input: {
  clientMessage: string;
  discussionNotes?: string | null;
}): string {
  return input.clientMessage.trim();
}

/** Unconfirmed projects have no baseline — never treat asks as covered or extra. */
export function enforceUnconfirmedAgreement(
  unconfirmed: boolean,
  analysis: AnalysisResult,
): AnalysisResult {
  if (!unconfirmed) return analysis;

  const demote = (item: Finding): Finding => ({
    ...item,
    reason:
      "This project has no confirmed agreement yet. Record what’s already agreed, or prepare a first proposal.",
    clarificationQuestion:
      item.clarificationQuestion ??
      "What has already been agreed for this project?",
    reviewKind: "classification",
  });

  const unclear = [
    ...analysis.unclear.map(demote),
    ...analysis.included.map(demote),
    ...analysis.additional.map(demote),
  ];

  return ensureFindingIds(
    analysisSchema.parse({
      ...analysis,
      included: [],
      additional: [],
      unclear,
      primaryOutcome: derivePrimaryOutcome({
        included: [],
        additional: [],
        unclear,
      }),
      sourceDetail:
        analysis.sourceDetail ??
        "No agreement yet — set up the project before treating work as covered",
      options: [
        {
          kind: "clarify",
          summary:
            "Record an existing agreement or prepare a first proposal for this job",
        },
      ],
    }),
  );
}

/** @deprecated Use enforceUnconfirmedAgreement(isAgreementUnconfirmed(...), analysis). */
export function enforceProvisionalAgreement(
  scope: string,
  analysis: AnalysisResult,
): AnalysisResult {
  return enforceUnconfirmedAgreement(isProvisionalAgreement(scope), analysis);
}
