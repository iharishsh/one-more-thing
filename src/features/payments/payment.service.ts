import {
  AgreementStatus,
  PaymentStatus,
  ProposalStatus,
  WebhookProcessingStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { refreshProjectSummarySoon } from "@/features/projects/project-summary";
import { assertSameMoney, centsToUsd } from "@/lib/money";
import { canPay } from "@/features/proposals/proposal-state";
import {
  captureOrderSchema,
  createOrderSchema,
  type CaptureOrderInput,
  type CreateOrderInput,
} from "@/features/payments/payment.schema";
import { getProposalByToken } from "@/server/access";
import { prisma } from "@/server/db";
import {
  planAgreementApply,
  type AgreementApplyTerms,
} from "@/features/payments/agreement-apply";
import {
  shouldMarkClientAccepted,
  shouldReplaceAgreementBaseline,
} from "@/features/payments/agreement-lifecycle";
import {
  capturePaypalOrder,
  createPaypalOrder,
  getPaypalOrder,
} from "@/server/paypal/orders";

export async function createPaymentOrder(raw: CreateOrderInput) {
  const input = createOrderSchema.parse(raw);
  const proposal = await getProposalByToken(input.proposalToken);

  if (!proposal.acceptance) {
    throw new Error("Client must accept the proposal before paying");
  }
  if (!canPay(proposal.status, true, proposal.priceCents)) {
    throw new Error("This proposal is not payable");
  }

  const existingCaptured = proposal.payments.find(
    (p) => p.status === PaymentStatus.CAPTURED,
  );
  if (existingCaptured) {
    throw new Error("Proposal already paid");
  }

  // Reconcile open orders against PayPal before creating another.
  for (const open of proposal.payments.filter(
    (p) =>
      (p.status === PaymentStatus.CREATED ||
        p.status === PaymentStatus.APPROVED) &&
      p.paypalOrderId,
  )) {
    const reconciled = await reconcileOpenPayment(open.id, open.paypalOrderId!);
    if (reconciled?.status === PaymentStatus.CAPTURED) {
      throw new Error("Proposal already paid");
    }
    if (
      reconciled &&
      (reconciled.status === PaymentStatus.CREATED ||
        reconciled.status === PaymentStatus.APPROVED) &&
      reconciled.paypalOrderId &&
      reconciled.expectedAmountCents === proposal.priceCents
    ) {
      return {
        orderId: reconciled.paypalOrderId,
        paymentId: reconciled.id,
      };
    }
  }

  await abandonUnresolvedPayments(proposal.id);

  const payment = await prisma.payment.create({
    data: {
      proposalId: proposal.id,
      proposalVersion: proposal.version,
      expectedAmountCents: proposal.priceCents,
      currency: proposal.currency,
      status: PaymentStatus.CREATED,
    },
  });

  try {
    const order = await createPaypalOrder({
      amountValue: centsToUsd(proposal.priceCents),
      currency: proposal.currency,
      customId: payment.id,
      description: `One More Thing proposal v${proposal.version}`,
      requestId: `omt-create-${payment.id}`,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paypalOrderId: order.id,
        status: PaymentStatus.APPROVED,
      },
    });

    return { orderId: order.id!, paymentId: updated.id };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    throw error;
  }
}

/**
 * Ask PayPal for the live order state before guessing FAILED.
 * COMPLETED → process capture; APPROVED/CREATED → keep reusable; else abandon.
 */
export async function reconcileOpenPayment(
  paymentId: string,
  paypalOrderId: string,
) {
  try {
    const order = await getPaypalOrder(paypalOrderId);
    const status = order.status;

    if (status === "COMPLETED") {
      const { payment } = await processVerifiedCapture({
        paymentId,
        paypalOrderId,
        capturePayload: order,
      });
      return payment;
    }

    if (status === "APPROVED" || status === "CREATED" || status === "PAYER_ACTION_REQUIRED") {
      return prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    }

    // VOIDED / EXPIRED / unknown — mark abandoned, not as a known payment failure
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        rawCaptureJson: {
          reconciledStatus: status ?? "UNKNOWN",
          reconciledAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.warn(
      "[paypal] reconcile getOrder failed; leaving payment open for retry",
      error instanceof Error ? error.message : error,
    );
    return prisma.payment.findUnique({ where: { id: paymentId } });
  }
}

/** Mark only payments that are still open after reconciliation attempts. */
export async function abandonUnresolvedPayments(proposalId: string) {
  await prisma.payment.updateMany({
    where: {
      proposalId,
      status: { in: [PaymentStatus.CREATED, PaymentStatus.APPROVED] },
    },
    data: { status: PaymentStatus.FAILED },
  });
}

/** @deprecated Prefer abandonUnresolvedPayments after reconcileOpenPayment */
export async function abandonOpenPayments(proposalId: string) {
  return abandonUnresolvedPayments(proposalId);
}

export async function capturePaymentOrder(raw: CaptureOrderInput) {
  const input = captureOrderSchema.parse(raw);
  const proposal = await getProposalByToken(input.proposalToken);
  const payment = await prisma.payment.findFirst({
    where: {
      proposalId: proposal.id,
      paypalOrderId: input.orderId,
    },
  });

  if (!payment) {
    throw new Error("Payment order not found for this proposal");
  }
  if (payment.status === PaymentStatus.CAPTURED) {
    return { payment, alreadyProcessed: true as const };
  }
  assertPaymentStillBoundToProposal(payment, proposal);

  const captureRequestId =
    payment.captureRequestId ?? `omt-capture-${payment.id}`;
  if (!payment.captureRequestId) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { captureRequestId },
    });
  }

  const captured = await capturePaypalOrder({
    orderId: input.orderId,
    requestId: captureRequestId,
  });

  return processVerifiedCapture({
    paymentId: payment.id,
    paypalOrderId: input.orderId,
    capturePayload: captured,
  });
}

export async function processVerifiedCapture(args: {
  paymentId: string;
  paypalOrderId: string;
  capturePayload: {
    id?: string;
    status?: string;
    purchaseUnits?: Array<{
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: { currencyCode?: string; value?: string };
        }>;
      };
    }>;
  };
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: args.paymentId },
    include: {
      proposal: {
        include: { changeRequest: true },
      },
    },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.paypalOrderId !== args.paypalOrderId) {
    throw new Error("PayPal order mismatch");
  }
  if (payment.status === PaymentStatus.CAPTURED) {
    return { payment, alreadyProcessed: true as const };
  }
  // Completed captures reconcile to the order's proposal only — never a newer version.
  if (
    payment.proposalVersion !== payment.proposal.version ||
    payment.expectedAmountCents !== payment.proposal.priceCents
  ) {
    throw new Error(
      "Payment order no longer matches the proposal version or amount",
    );
  }
  if (
    payment.proposal.status === ProposalStatus.SUPERSEDED ||
    payment.proposal.status === ProposalStatus.REVOKED ||
    payment.proposal.status === ProposalStatus.DECLINED ||
    payment.proposal.status === ProposalStatus.CHANGES_REQUESTED
  ) {
    throw new Error(
      `Cannot capture payment for proposal in status ${payment.proposal.status}`,
    );
  }

  const capture =
    args.capturePayload.purchaseUnits?.[0]?.payments?.captures?.[0];
  if (!capture?.id || !capture.amount?.value || !capture.amount.currencyCode) {
    throw new Error("Capture response missing amount details");
  }
  if (capture.status && capture.status !== "COMPLETED") {
    throw new Error(`Capture not completed: ${capture.status}`);
  }

  assertSameMoney(
    payment.expectedAmountCents,
    capture.amount.value,
    capture.amount.currencyCode,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.CAPTURED,
        paypalCaptureId: capture.id,
        rawCaptureJson: args.capturePayload as Prisma.InputJsonValue,
      },
    });

    await tx.proposal.update({
      where: { id: payment.proposalId },
      data: { status: ProposalStatus.ACCEPTED },
    });

    await tx.activityEvent.create({
      data: {
        projectId: payment.proposal.changeRequest.projectId,
        kind: "payment.captured",
        message: `Payment captured for ${capture.amount!.value} ${capture.amount!.currencyCode}`,
        metadata: {
          paymentId: payment.id,
          paypalCaptureId: capture.id,
          paypalOrderId: args.paypalOrderId,
        },
      },
    });

    return next;
  });

  await applyProposalDeliveryChanges(payment.proposalId);
  refreshProjectSummarySoon(payment.proposal.changeRequest.projectId);
  const { draftPayoutsSoon } = await import("@/features/billing/payouts.service");
  draftPayoutsSoon(payment.proposalId);

  return { payment: updated, alreadyProcessed: false as const };
}

/**
 * On client accept: mark CLIENT_ACCEPTED for first-proposal paths only.
 * Does not create deliverables — paid delivery still waits for capture.
 * Never overwrites a freelancer-recorded baseline.
 */
export async function markClientAcceptedOnAccept(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { changeRequest: { include: { project: true } } },
  });
  if (!proposal) throw new Error("Proposal not found");

  const project = proposal.changeRequest.project;
  const terms = proposal.termsJson as AgreementApplyTerms;
  if (!shouldMarkClientAccepted(project.agreementStatus, terms)) {
    return project;
  }

  const replaceBaseline = shouldReplaceAgreementBaseline(
    project.agreementStatus,
    project.currentScope,
    terms,
  );
  const plan = planAgreementApply({
    currentScope: project.currentScope,
    currentScopeVersion: project.currentScopeVersion,
    proposalVersion: proposal.version,
    summary: proposal.summary,
    terms,
    establishesAgreement: replaceBaseline,
  });

  return prisma.project.update({
    where: { id: project.id },
    data: {
      agreementStatus: AgreementStatus.CLIENT_ACCEPTED,
      agreementRecordedAt: new Date(),
      agreementSource: `Client accepted proposal v${proposal.version}`,
      ...(replaceBaseline && plan.scopeChanged
        ? {
            currentScope: plan.nextScope,
            currentScopeVersion: { increment: 1 },
          }
        : {}),
    },
  });
}

export async function applyProposalDeliveryChanges(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { changeRequest: true, deliverables: true },
  });
  if (!proposal) throw new Error("Proposal not found");
  // Idempotent: this proposal's deliverables already applied — leave siblings alone.
  if (proposal.deliverables.length > 0) {
    return proposal.deliverables;
  }

  const terms = proposal.termsJson as AgreementApplyTerms;

  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction so concurrent captures cannot double-append.
    const already = await tx.deliverable.count({
      where: { proposalId: proposal.id },
    });
    if (already > 0) {
      return tx.deliverable.findMany({ where: { proposalId: proposal.id } });
    }

    const project = await tx.project.findUniqueOrThrow({
      where: { id: proposal.changeRequest.projectId },
    });

    const replaceBaseline = shouldReplaceAgreementBaseline(
      project.agreementStatus,
      project.currentScope,
      terms,
    );
    const markAccepted = shouldMarkClientAccepted(
      project.agreementStatus,
      terms,
    );

    const plan = planAgreementApply({
      currentScope: project.currentScope,
      currentScopeVersion: project.currentScopeVersion,
      proposalVersion: proposal.version,
      summary: proposal.summary,
      terms,
      establishesAgreement: replaceBaseline,
    });

    // Confirmation-only included_ack: no deliverables, no version bump, no round burn.
    if (plan.noop) {
      if (markAccepted) {
        await tx.project.update({
          where: { id: project.id },
          data: {
            agreementStatus: AgreementStatus.CLIENT_ACCEPTED,
            agreementRecordedAt: new Date(),
            agreementSource: `Client accepted proposal v${proposal.version}`,
          },
        });
      }
      return [];
    }

    const rows = [];
    for (const item of plan.deliverableCreates) {
      rows.push(
        await tx.deliverable.create({
          data: {
            projectId: project.id,
            proposalId: proposal.id,
            title: item.title,
            description: item.description,
          },
        }),
      );
    }

    if (plan.scopeChanged || plan.consumeRevisionRound || markAccepted) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          ...(plan.scopeChanged
            ? {
                currentScopeVersion: { increment: 1 },
                currentScope: plan.nextScope,
              }
            : {}),
          // Never overwrite FREELANCER_RECORDED — markAccepted is false then.
          ...(markAccepted
            ? {
                agreementStatus: AgreementStatus.CLIENT_ACCEPTED,
                agreementRecordedAt: new Date(),
                agreementSource: `Client accepted proposal v${proposal.version}`,
              }
            : {}),
          ...(plan.consumeRevisionRound
            ? { revisionRoundsUsed: { increment: 1 } }
            : {}),
        },
      });
    }

    if (plan.scopeChanged || rows.length > 0) {
      await tx.activityEvent.create({
        data: {
          projectId: project.id,
          kind: "delivery.updated",
          message: `Applied ${rows.length} checklist update(s) from proposal v${proposal.version}`,
          metadata: {
            proposalId: proposal.id,
            previousScope: plan.previousScope,
            previousScopeVersion: plan.previousScopeVersion,
            nextScope: plan.nextScope,
            scopeChanged: plan.scopeChanged,
            consumeRevisionRound: plan.consumeRevisionRound,
            optionKind: terms.selectedOption?.kind ?? null,
          },
        },
      });
    }

    if (plan.consumeRevisionRound) {
      await tx.activityEvent.create({
        data: {
          projectId: project.id,
          kind: "revision.round_used",
          message: `Used 1 revision round from proposal v${proposal.version}`,
          metadata: {
            proposalId: proposal.id,
            previousScopeVersion: plan.previousScopeVersion,
            explicit: true,
          },
        },
      });
    }

    return rows;
  });
}

export async function recordWebhookEvent(args: {
  eventId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}) {
  try {
    return await prisma.webhookEvent.create({
      data: {
        eventId: args.eventId,
        eventType: args.eventType,
        payloadJson: args.payload,
        status: WebhookProcessingStatus.RECEIVED,
      },
    });
  } catch {
    return prisma.webhookEvent.findUniqueOrThrow({
      where: { eventId: args.eventId },
    });
  }
}

/**
 * Claim an event for processing. PROCESSED duplicates are no-ops.
 * FAILED / RECEIVED remain retryable. Concurrent claims are rejected.
 */
export async function claimWebhookEvent(eventId: string) {
  const staleBefore = new Date(Date.now() - 60_000);
  const claimed = await prisma.webhookEvent.updateMany({
    where: {
      eventId,
      status: {
        in: [WebhookProcessingStatus.RECEIVED, WebhookProcessingStatus.FAILED],
      },
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }],
    },
    data: {
      claimedAt: new Date(),
      attemptCount: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count === 0) {
    return prisma.webhookEvent.findUniqueOrThrow({ where: { eventId } });
  }
  return prisma.webhookEvent.findUniqueOrThrow({ where: { eventId } });
}

export async function markWebhookProcessed(
  eventId: string,
  status: WebhookProcessingStatus,
  lastError?: string,
) {
  return prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status,
      processedAt:
        status === WebhookProcessingStatus.PROCESSED ||
        status === WebhookProcessingStatus.IGNORED
          ? new Date()
          : undefined,
      claimedAt: null,
      lastError: lastError ?? null,
    },
  });
}

function assertPaymentStillBoundToProposal(
  payment: {
    proposalVersion: number;
    expectedAmountCents: number;
  },
  proposal: {
    version: number;
    priceCents: number;
    status: ProposalStatus;
  },
) {
  if (payment.proposalVersion !== proposal.version) {
    throw new Error("PayPal order is bound to a different proposal version");
  }
  if (payment.expectedAmountCents !== proposal.priceCents) {
    throw new Error("PayPal order amount no longer matches the proposal");
  }
  if (proposal.status !== ProposalStatus.ACCEPTED) {
    throw new Error("Proposal is not in an accepted payable state");
  }
}
