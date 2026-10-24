import { PaymentStatus, ProposalStatus } from "@/generated/prisma/client";
import {
  analysisStatusLabel,
  shortRequestTitle,
} from "@/features/changes/analysis-display";
import { getAnalysis } from "@/features/changes/change.service";
import type { AttentionItem } from "@/components/attention-panel";

type ChangeLike = {
  id: string;
  clientMessage: string;
  analysisJson: unknown;
  project: {
    id: string;
    title: string;
    agreementStatus?: string | null;
  };
  proposals: Array<{
    status: string;
    acceptance: unknown;
    revokedAt?: Date | null;
    payments: Array<{ status: PaymentStatus | string }>;
    billingActions?: Array<{ status: string }>;
  }>;
};

/** Map a change into an actionable or waiting attention row. */
export function toAttentionItem(change: ChangeLike): AttentionItem | null {
  const href = `/workspace/projects/${change.project.id}/changes/${change.id}`;
  const latest = change.proposals[0];

  let analysis = null as ReturnType<typeof getAnalysis> | null;
  try {
    analysis = getAnalysis(change);
  } catch {
    analysis = null;
  }
  const summary = shortRequestTitle(analysis, change.clientMessage);

  if (!latest) {
    if (change.project.agreementStatus === "UNCONFIRMED") {
      return {
        id: change.id,
        projectTitle: change.project.title,
        summary,
        statusLabel: "Set up project",
        href: `/workspace/projects/${change.project.id}`,
        actionLabel: "Set up project",
        kind: "action",
      };
    }
    if (
      analysis?.freelancerDecision?.kind === "included" &&
      analysis.additional.length === 0
    ) {
      // Fully settled internally — optional share lives on the request page.
      return null;
    }
    if (analysis) {
      const status = analysisStatusLabel(analysis);
      return {
        id: change.id,
        projectTitle: change.project.title,
        summary,
        statusLabel: status.label,
        href,
        actionLabel: status.actionLabel,
        kind: "action",
      };
    }
    return {
      id: change.id,
      projectTitle: change.project.title,
      summary,
      statusLabel: "Needs review",
      href,
      actionLabel: "Review draft",
      kind: "action",
    };
  }

  if (latest.revokedAt || latest.status === ProposalStatus.REVOKED) {
    return null;
  }

  const paid = latest.payments.some(
    (p) =>
      p.status === PaymentStatus.CAPTURED ||
      String(p.status).toUpperCase() === "CAPTURED",
  );
  if (paid) {
    if (latest.billingActions?.some((a) => a.status === "PROPOSED")) {
      return {
        id: change.id,
        projectTitle: change.project.title,
        summary,
        statusLabel: "AI drafted a subcontractor payout",
        href,
        actionLabel: "Approve",
        kind: "action",
      };
    }
    return null;
  }

  if (latest.acceptance || latest.status === ProposalStatus.ACCEPTED) {
    if (latest.billingActions?.some((a) => a.status === "PROPOSED")) {
      return {
        id: change.id,
        projectTitle: change.project.title,
        summary,
        statusLabel: "AI drafted a payment step",
        href,
        actionLabel: "Approve",
        kind: "action",
      };
    }
    return {
      id: change.id,
      projectTitle: change.project.title,
      summary,
      statusLabel: "Awaiting payment",
      href,
      actionLabel: "View proposal",
      kind: "action",
    };
  }

  if (latest.status === ProposalStatus.PUBLISHED) {
    return {
      id: change.id,
      projectTitle: change.project.title,
      summary,
      statusLabel: "Awaiting client",
      href,
      actionLabel: "Share proposal",
      kind: "waiting",
    };
  }

  if (
    latest.status === "DECLINED" ||
    latest.status === "CHANGES_REQUESTED"
  ) {
    return {
      id: change.id,
      projectTitle: change.project.title,
      summary,
      statusLabel:
        latest.status === "DECLINED" ? "Declined" : "Changes requested",
      href,
      actionLabel: "Review draft",
      kind: "action",
    };
  }

  return null;
}
