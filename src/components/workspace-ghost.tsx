import { AppHeader } from "@/components/app-header";
import { PageMain, PageShell, SplitLayout } from "@/components/page-shell";

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
                <div className="h-10 w-24 animate-pulse rounded-full bg-muted" />
              </div>

              <ul className="border-t border-border" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 border-b border-border py-4"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-5 w-48 max-w-full animate-pulse rounded-md bg-muted" />
                      <div className="h-3.5 w-36 max-w-[70%] animate-pulse rounded-md bg-muted/80" />
                    </div>
                    <div className="h-10 w-16 shrink-0 animate-pulse rounded-full bg-muted" />
                  </li>
                ))}
              </ul>
            </>
          }
          sidebar={
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 animate-pulse rounded-full bg-muted" />
                <div className="h-10 animate-pulse rounded-full bg-muted" />
              </div>

              <section className="space-y-2" aria-hidden>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
                  <div className="h-5 w-5 animate-pulse rounded-full bg-[color:var(--attention)]/50" />
                </div>
                <ul className="divide-y divide-border border-t border-border">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3 w-24 animate-pulse rounded-md bg-muted/70" />
                        <div className="h-3.5 w-full max-w-[12rem] animate-pulse rounded-md bg-muted" />
                        <div className="h-3 w-16 animate-pulse rounded-md bg-muted/60" />
                      </div>
                      <div className="h-10 w-[5.5rem] shrink-0 animate-pulse rounded-full bg-muted" />
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3" aria-hidden>
                <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
                <ul className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="space-y-1.5">
                      <div className="h-3.5 w-full max-w-[16rem] animate-pulse rounded-md bg-muted" />
                      <div className="h-3 w-28 animate-pulse rounded-md bg-muted/70" />
                    </li>
                  ))}
                </ul>
              </section>
            </>
          }
        />
      </PageMain>
    </PageShell>
  );
}
