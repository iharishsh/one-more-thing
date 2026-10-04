import { ProposalStatus } from "@/generated/prisma/client";

export function canAccept(status: ProposalStatus) {
  return status === ProposalStatus.PUBLISHED;
}

export function canPay(
  status: ProposalStatus,
  accepted: boolean,
  priceCents: number,
) {
  if (!accepted || priceCents <= 0) return false;
  // Only the accepted open proposal — not superseded/revoked/declined.
  return status === ProposalStatus.ACCEPTED;
}

export function canApplyDelivery(status: ProposalStatus, paidOrFree: boolean) {
  return paidOrFree && status === ProposalStatus.ACCEPTED;
}

export function canRespond(status: ProposalStatus) {
  return status === ProposalStatus.PUBLISHED;
}
