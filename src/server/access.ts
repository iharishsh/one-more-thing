import { prisma } from "@/server/db";

export async function assertProjectOwner(projectId: string, ownerId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
  });
  if (!project) {
    throw new Error("Project not found or access denied");
  }
  return project;
}

const proposalInclude = {
  acceptance: true,
  payments: { orderBy: { createdAt: "desc" as const } },
  changeRequest: {
    include: {
      project: {
        include: { deliverables: { orderBy: { createdAt: "asc" as const } } },
      },
    },
  },
} as const;

export type ProposalLinkState = "active" | "revoked" | "expired" | "missing";

/** Lookup only — does not enforce active link rules. */
export async function findProposalByToken(token: string) {
  return prisma.proposal.findUnique({
    where: { clientToken: token },
    include: proposalInclude,
  });
}

/**
 * Active token for accept / pay / respond.
 * Revoked or expired links are rejected (mutations must not proceed).
 */
export async function getProposalByToken(token: string) {
  const proposal = await findProposalByToken(token);
  if (!proposal) {
    throw new Error("Proposal not found");
  }
  if (proposal.revokedAt) {
    throw new Error("Proposal link revoked");
  }
  if (proposal.tokenExpiresAt && proposal.tokenExpiresAt < new Date()) {
    throw new Error("Proposal link expired");
  }
  return proposal;
}

/** Minimal public status for invalidated links — no agreement body. */
export async function getProposalLinkStatus(token: string): Promise<{
  state: ProposalLinkState;
  summary?: string;
  version?: number;
}> {
  const proposal = await prisma.proposal.findUnique({
    where: { clientToken: token },
    select: {
      summary: true,
      version: true,
      revokedAt: true,
      tokenExpiresAt: true,
    },
  });
  if (!proposal) return { state: "missing" };
  if (proposal.revokedAt) {
    return {
      state: "revoked",
      summary: proposal.summary,
      version: proposal.version,
    };
  }
  if (proposal.tokenExpiresAt && proposal.tokenExpiresAt < new Date()) {
    return {
      state: "expired",
      summary: proposal.summary,
      version: proposal.version,
    };
  }
  return {
    state: "active",
    summary: proposal.summary,
    version: proposal.version,
  };
}

export async function assertProposalTokenAccess(token: string) {
  return getProposalByToken(token);
}
