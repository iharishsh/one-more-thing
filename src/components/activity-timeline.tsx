import Link from "next/link";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  kind: string;
  message: string;
  createdAt: Date | string;
  projectTitle?: string | null;
};

const KIND_LABEL: Record<string, string> = {
  "change.analyzed": "Request reviewed",
  "change.marked_included": "Marked as covered",
  "change.deleted": "Draft deleted",
  "proposal.published": "Proposal published",
  "proposal.accepted": "Proposal accepted",
  "proposal.revoked": "Link withdrawn",
  "proposal.declined": "Client declined",
  "proposal.changes_requested": "Client asked for changes",
  "payment.captured": "Payment received",
  "delivery.updated": "Agreement updated",
  "intake.received": "Client request",
  "billing.proposed": "Needs approval",
  "billing_agent.create_invoice": "PayPal invoice",
  "billing_agent.send_invoice": "PayPal invoice",
  "billing_agent.send_invoice_reminder": "Payment reminder",
  "payment.invoice_paid": "Payment received",
  "payment.duplicate": "Payment issue",
  "revision.round_used": "Revision round used",
  "project.created": "Project created",
  "agreement.recorded": "Agreement recorded",
  "agent.draft_ready": "Ready to review",
};

/** Routine noise — keep out of compact timelines. */
const COLLAPSED_KINDS = new Set([
  "agent.prepare_started",
  "agent.needs_review",
]);

function readableMessage(message: string) {
  if (/analyzed via|Scope change analyzed/i.test(message)) {
    return "Request reviewed against the current agreement";
  }
  if (/Deleted a change request/i.test(message)) {
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

function formatWhen(value: Date | string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ActivityTimeline({
  events,
  limit,
  viewAllHref,
  className,
}: {
  events: Activity[];
  limit?: number;
  viewAllHref?: string;
  className?: string;
}) {
  const useful = events.filter((e) => !COLLAPSED_KINDS.has(e.kind));
  const visible = limit ? useful.slice(0, limit) : useful;

  if (useful.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No activity yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <ol className="space-y-3">
        {visible.map((event) => (
          <li key={event.id} className="border-l-2 border-border pl-3">
            <p className="text-sm tracking-body text-foreground">
              {event.projectTitle ? (
                <span className="font-medium">{event.projectTitle} · </span>
              ) : null}
              {readableMessage(event.message)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {KIND_LABEL[event.kind] ?? "Activity"} · {formatWhen(event.createdAt)}
            </p>
          </li>
        ))}
      </ol>
      {viewAllHref && useful.length > 0 ? (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--brand)] no-underline hover:text-[color:var(--brand-bright)]"
        >
          {limit && useful.length > limit ? "View all activity" : "View activity"}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}
