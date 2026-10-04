import { prisma } from "@/server/db";

const KIND_LABEL: Record<string, string> = {
  "change.analyzed": "Request reviewed",
  "change.deleted": "Draft deleted",
  "proposal.published": "Proposal published",
  "proposal.accepted": "Proposal accepted",
  "proposal.revoked": "Link withdrawn",
  "proposal.declined": "Client declined",
  "proposal.changes_requested": "Client asked for changes",
  "payment.captured": "Payment received",
  "delivery.updated": "Agreement updated",
  "project.created": "Project created",
  "project.status": "Status updated",
};

function readableMessage(message: string) {
  if (/analyzed via|Scope change analyzed/i.test(message)) {
    return "Request reviewed against the current agreement";
  }
  if (/Deleted a change request|Unpublished request deleted/i.test(message)) {
    return "Unpublished request deleted";
  }
  if (/Payment captured for/i.test(message)) {
    return message.replace(/^Payment captured for/, "Payment received for");
  }
  if (/Applied \d+ deliverable/i.test(message)) {
    return message.replace(
      /Applied (\d+) deliverable change\(s\) from proposal/,
      "Agreement updated from proposal",
    );
  }
  return message;
}

function hrefFromMetadata(
  projectId: string,
  kind: string,
  metadata: unknown,
): string | null {
  const meta =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : null;
  const changeId =
    typeof meta?.changeRequestId === "string" ? meta.changeRequestId : null;

  if (changeId && kind.startsWith("change.")) {
    return `/workspace/projects/${projectId}/changes/${changeId}`;
  }
  if (changeId && (kind.startsWith("proposal.") || kind.startsWith("payment."))) {
    return `/workspace/projects/${projectId}/changes/${changeId}`;
  }
  return `/workspace/projects/${projectId}`;
}

export async function listActivityRows(ownerId: string) {
  const events = await prisma.activityEvent.findMany({
    where: { project: { ownerId } },
    include: { project: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return events.map((event) => ({
    id: event.id,
    projectTitle: event.project.title,
    kind: event.kind,
    kindLabel: KIND_LABEL[event.kind] ?? "Activity",
    message: readableMessage(event.message),
    createdAt: event.createdAt.toISOString(),
    href: hrefFromMetadata(event.project.id, event.kind, event.metadata),
  }));
}
