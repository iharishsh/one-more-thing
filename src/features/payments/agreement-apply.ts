/**
 * Plan how accepted/paid proposal terms update the live agreement.
 * Confirmation-only acknowledgments are no-ops. Revision rounds are consumed
 * only when terms.consumesRevisionRound is set and the agreement actually changes.
 */

export type AgreementApplyTerms = {
  deliverableChanges?: Array<{ title: string; description?: string }>;
  deliveryNote?: string | null;
  existingWorkNote?: string | null;
  selectedOption?: { kind?: string };
  /** Explicit freelancer intent — never inferred from option kind alone. */
  consumesRevisionRound?: boolean;
  quoteLines?: Array<{
    kind: string;
    label: string;
    amountCents: number;
    product?: { title?: string; buyUrl?: string } | null;
  }>;
};

export type AgreementApplyPlan = {
  /** No deliverables, no scope change, no revision burn. */
  noop: boolean;
  scopeChanged: boolean;
  previousScope: string;
  previousScopeVersion: number;
  nextScope: string;
  consumeRevisionRound: boolean;
  marker: string;
  addition: string;
  deliverableCreates: Array<{
    title: string;
    description: string | null;
  }>;
};

function isConfirmationOnly(
  terms: AgreementApplyTerms,
  changeCount: number,
  productCount: number,
): boolean {
  if (terms.selectedOption?.kind !== "included_ack") return false;
  if (changeCount === 0 && productCount === 0) return true;
  const note = (terms.existingWorkNote ?? "").toLowerCase();
  return (
    note.includes("confirmation only") ||
    note.includes("no change to the agreed deliverables")
  );
}

export function planAgreementApply(input: {
  currentScope: string;
  currentScopeVersion: number;
  proposalVersion: number;
  summary: string;
  terms: AgreementApplyTerms;
  /** When true, this proposal establishes the first baseline (no prior agreement). */
  establishesAgreement?: boolean;
}): AgreementApplyPlan {
  const changes = input.terms.deliverableChanges ?? [];
  const productLines = (input.terms.quoteLines ?? []).filter(
    (l) => l.kind === "product" || l.kind === "materials",
  );

  if (isConfirmationOnly(input.terms, changes.length, productLines.length)) {
    return {
      noop: true,
      scopeChanged: false,
      previousScope: input.currentScope,
      previousScopeVersion: input.currentScopeVersion,
      nextScope: input.currentScope,
      consumeRevisionRound: false,
      marker: "",
      addition: "",
      deliverableCreates: [],
    };
  }

  const marker = `--- Agreed change (proposal v${input.proposalVersion}) ---`;
  const deliverableCreates = [
    ...changes.map((item) => ({
      title: item.title,
      description: item.description ?? input.terms.deliveryNote ?? null,
    })),
    ...productLines.map((line) => ({
      title: `Source: ${line.label}`,
      description: line.product?.buyUrl
        ? `Purchase manually after payment. Estimate only. Link: ${line.product.buyUrl}`
        : "Purchase manually after payment. Product estimate only — not an automatic retailer order.",
    })),
  ];

  const addition = [
    "",
    marker,
    input.summary,
    input.terms.deliveryNote ? `Note: ${input.terms.deliveryNote}` : null,
    ...changes.map((c) => `+ ${c.title}`),
    ...productLines.map((l) => `+ Source materials: ${l.label}`),
  ]
    .filter(Boolean)
    .join("\n");

  // First proposal on an unconfirmed project becomes the baseline — do not
  // append to empty/legacy intake text.
  const baselineBody = [
    input.summary,
    input.terms.deliveryNote ? `Delivery: ${input.terms.deliveryNote}` : null,
    ...changes.map((c) => `- ${c.title}`),
    ...productLines.map((l) => `- Source materials: ${l.label}`),
  ]
    .filter(Boolean)
    .join("\n");

  const nextScope = input.establishesAgreement
    ? baselineBody
    : input.currentScope.includes(marker)
      ? input.currentScope
      : `${input.currentScope}${addition}`;
  const scopeChanged = nextScope !== input.currentScope;

  // Round consumption requires an explicit recorded intent on the proposal terms.
  // Included amendments, confirmations, and paid extras do not auto-burn rounds.
  const consumeRevisionRound =
    Boolean(input.terms.consumesRevisionRound) &&
    input.terms.selectedOption?.kind === "included_ack" &&
    scopeChanged;

  return {
    noop: deliverableCreates.length === 0 && !scopeChanged,
    scopeChanged,
    previousScope: input.currentScope,
    previousScopeVersion: input.currentScopeVersion,
    nextScope,
    consumeRevisionRound,
    marker,
    addition,
    deliverableCreates,
  };
}
