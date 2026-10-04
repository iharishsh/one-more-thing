import { AppHeader } from "@/components/app-header";
import { PageMain, PageShell, SplitLayout } from "@/components/page-shell";
import { cn } from "@/lib/utils";

/**
 * Skeleton that mirrors the workspace page chrome so auth→workspace handoff
 * never drops to a blank frame while the real route streams in.
 */
export function WorkspaceGhost({
  includeHeader = true,
  className,
  bodyClassName,
}: {
  includeHeader?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <PageShell className={className}>
      {includeHeader ? <AppHeader /> : null}
      <PageMain className={bodyClassName}>
        <SplitLayout
          mobileSidebarFirst
          main={
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-heading">Workspace</span>
                  <span
                    className="text-subhead translate-y-px text-foreground/35"
                    aria-hidden
                  >
                    ·
                  </span>
                  <span className="text-subhead text-foreground">Projects</span>
                </h1>
                <div className="h-9 w-24 animate-pulse rounded-full bg-muted" />
              </div>

              <div
                className={cn(
                  "flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/70 px-6 py-12",
                )}
                aria-hidden
              >
                <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
                <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded-md bg-muted/80" />
                <div className="mt-2 h-4 w-2/3 max-w-sm animate-pulse rounded-md bg-muted/70" />
                <div className="mt-8 h-11 w-36 animate-pulse rounded-full bg-muted" />
              </div>
            </>
          }
          sidebar={
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 animate-pulse rounded-full bg-muted" />
                <div className="h-10 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="min-h-[9rem] animate-pulse rounded-2xl bg-[color:var(--attention)]/35" />
              <section className="space-y-3">
                <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
                <div className="surface-card h-16 animate-pulse bg-card" />
              </section>
            </>
          }
        />
      </PageMain>
    </PageShell>
  );
}
