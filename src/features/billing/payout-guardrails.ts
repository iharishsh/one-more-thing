// Pure rules for subcontractor payouts. The amount is never chosen by AI: it is
// the subcontractor's agreed share of what the client actually paid.

export type PayoutContext = {
  proposalId: string;
  priceCents: number;
  currency: string;
  paid: boolean;
  subcontractor: {
    id: string;
    paypalEmail: string;
    sharePercent: number;
  } | null;
  /** A payout to this subcontractor for this change already went out. */
  alreadyPaidOut: boolean;
};

export type PayoutArgs = {
  receiver: string;
  value: string;
  currency: string;
  note: string;
  sender_batch_id: string;
};

export function payoutCents(priceCents: number, sharePercent: number) {
  return Math.floor((priceCents * sharePercent) / 100);
}

/** PayPal rejects a reused sender_batch_id, so this also blocks double payouts. */
export function payoutBatchId(proposalId: string, subcontractorId: string) {
  return `omt-${proposalId}-${subcontractorId}`.slice(0, 127);
}

export function buildPayoutArgs(ctx: PayoutContext, note: string): PayoutArgs {
  const sub = ctx.subcontractor!;
  return {
    receiver: sub.paypalEmail,
    value: (payoutCents(ctx.priceCents, sub.sharePercent) / 100).toFixed(2),
    currency: ctx.currency,
    note: note.slice(0, 4000),
    sender_batch_id: payoutBatchId(ctx.proposalId, sub.id),
  };
}

export function checkPayout(
  args: Partial<PayoutArgs>,
  ctx: PayoutContext,
): { ok: true; args: PayoutArgs } | { ok: false; error: string } {
  const sub = ctx.subcontractor;
  if (!sub) return { ok: false, error: "Subcontractor was removed" };
  if (!ctx.paid) return { ok: false, error: "The client hasn't paid this change yet" };
  if (ctx.alreadyPaidOut) {
    return { ok: false, error: "This subcontractor was already paid for this change" };
  }
  if (sub.sharePercent < 1 || sub.sharePercent > 90) {
    return { ok: false, error: "Share must be between 1% and 90%" };
  }
  const expected = buildPayoutArgs(ctx, args.note ?? "");
  if (Number(expected.value) <= 0) {
    return { ok: false, error: "Payout amount rounds to zero" };
  }
  // Recipient, amount and batch id always come from current records.
  if (
    args.receiver?.toLowerCase() !== sub.paypalEmail.toLowerCase() ||
    args.value !== expected.value ||
    args.currency !== ctx.currency ||
    args.sender_batch_id !== expected.sender_batch_id
  ) {
    return {
      ok: false,
      error: "Payout no longer matches the subcontractor's email or share. Draft it again.",
    };
  }
  return { ok: true, args: expected };
}
