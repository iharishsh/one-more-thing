"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  id: string;
  projectTitle: string;
  summary: string;
  statusLabel: string;
  href: string;
  /** Specific CTA — Review draft, Share proposal, Add details, etc. */
  actionLabel: string;
  kind: "action" | "waiting";
};

const PREVIEW = 3;

export function AttentionPanel({
  items,
  className,
}: {
  items: AttentionItem[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const actions = items.filter((i) => i.kind === "action");
  const waiting = items.filter((i) => i.kind === "waiting");
  const visibleActions = expanded ? actions : actions.slice(0, PREVIEW);
  const hasMore = actions.length > PREVIEW;

  return (
    <section className={cn("space-y-4", className)} aria-label="Your next actions">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-normal">
            Your next actions
            {actions.length > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--attention)] px-1.5 text-xs text-[color:var(--attention-foreground)]">
                {actions.length}
              </span>
            ) : null}
          </h2>
        </div>

        {actions.length === 0 ? (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            Nothing for you right now.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {visibleActions.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-xs text-muted-foreground">
                    {item.projectTitle}
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.summary}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.statusLabel}</p>
                </div>
                <Link
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "shrink-0 no-underline",
                  )}
                >
                  {item.actionLabel}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hasMore ? (
          <button
            type="button"
            className="text-sm font-medium text-[color:var(--brand)]"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show fewer" : `View all (${actions.length})`}
          </button>
        ) : null}
      </div>

      {waiting.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Waiting for client · {waiting.length}
          </h3>
          <ul className="space-y-2">
            {(expanded ? waiting : waiting.slice(0, 2)).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {item.summary}
                </span>
                <Link
                  href={item.href}
                  className="shrink-0 text-[color:var(--brand)] no-underline"
                >
                  {item.actionLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
