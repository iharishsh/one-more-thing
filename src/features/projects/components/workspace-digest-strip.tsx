import { formatUsd } from "@/lib/money";
import type { WorkspaceDigest } from "@/features/projects/workspace-digest";

/** One glanceable line: what needs you, what's waiting on others, what's paid. */
export function WorkspaceDigestStrip({ digest }: { digest: WorkspaceDigest }) {
  const items = [
    {
      label: "requests to review",
      value: String(digest.toReview),
      hot: digest.toReview > 0,
    },
    {
      label: "payment steps to approve",
      value: String(digest.toApprove),
      hot: digest.toApprove > 0,
    },
    {
      label: "waiting on clients",
      value: String(digest.awaitingClient),
      hot: false,
    },
    {
      label: "accepted, unpaid",
      value: formatUsd(digest.awaitingPaymentCents),
      hot: false,
    },
    {
      label: "paid this month",
      value: formatUsd(digest.paidThisMonthCents),
      hot: false,
    },
  ];
  return (
    <div className="space-y-2">
      {digest.recoveredCents > 0 || digest.coveredCount > 0 ? (
        <section
          aria-label="Scope creep caught"
          className="rounded-[var(--radius-xl)] bg-[#e5f6e8] px-4 py-3 text-[#0f5c2e]"
        >
          <p className="text-2xl font-extrabold tracking-heading">
            {formatUsd(digest.recoveredCents)}
          </p>
          <p className="text-sm">
            of &ldquo;one more thing&rdquo; requests turned into paid work
            instead of free work
            {digest.coveredCount > 0
              ? ` · ${digest.coveredCount} request${digest.coveredCount === 1 ? "" : "s"} confirmed as already included`
              : ""}
          </p>
        </section>
      ) : null}
      <section
        aria-label="Workspace digest"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-xl)] border bg-border sm:grid-cols-5"
      >
        {items.map((item) => (
          <div key={item.label} className="bg-card px-3 py-2.5">
            <p
              className={
                item.hot
                  ? "text-lg font-semibold text-[color:var(--brand)]"
                  : "text-lg font-semibold"
              }
            >
              {item.value}
            </p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
