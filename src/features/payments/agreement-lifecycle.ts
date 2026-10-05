import type { AgreementApplyTerms } from "@/features/payments/agreement-apply";

export function termsEstablishAgreement(terms: unknown): boolean {
  return Boolean(
    terms &&
      typeof terms === "object" &&
      "establishesAgreement" in terms &&
      (terms as { establishesAgreement?: boolean }).establishesAgreement,
  );
}

/**
 * CLIENT_ACCEPTED is only set from an unconfirmed project when the proposal
 * was published as a first-agreement path. Never overwrites FREELANCER_RECORDED.
 */
export function shouldMarkClientAccepted(
  agreementStatus: string,
  terms: unknown,
): boolean {
  return agreementStatus === "UNCONFIRMED" && termsEstablishAgreement(terms);
}

/**
 * First-proposal baseline replace is allowed for unconfirmed intake, or for
 * CLIENT_ACCEPTED projects that still have an empty scope (status set on accept,
 * delivery still pending). Never replace a freelancer-recorded baseline.
 */
export function shouldReplaceAgreementBaseline(
  agreementStatus: string,
  currentScope: string,
  terms: unknown,
): boolean {
  if (!termsEstablishAgreement(terms)) return false;
  if (agreementStatus === "FREELANCER_RECORDED") return false;
  if (agreementStatus === "UNCONFIRMED") return true;
  if (agreementStatus === "CLIENT_ACCEPTED" && !currentScope.trim()) return true;
  // Already has client-accepted baseline text — do not wipe it on capture.
  return false;
}

export type LifecycleTerms = AgreementApplyTerms & {
  establishesAgreement?: boolean;
};
