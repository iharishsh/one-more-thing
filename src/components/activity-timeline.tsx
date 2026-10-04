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
  "change.deleted": "Draft deleted",
  "proposal.published": "Proposal published",
  "proposal.accepted": "Proposal accepted",
  "proposal.revoked": "Link withdrawn",
  "proposal.declined": "Client declined",
  "proposal.changes_requested": "Client asked for changes",
  "payment.captured": "Payment received",
  "delivery.updated": "Agreement updated",
  "project.created": "Project created",
};

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
  const visible = limit ? events.slice(0, limit) : events;

  if (events.length === 0) {
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
      {viewAllHref && events.length > 0 ? (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--brand)] no-underline hover:text-[color:var(--brand-bright)]"
        >
          {limit && events.length > limit ? "View all activity" : "View activity"}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}
