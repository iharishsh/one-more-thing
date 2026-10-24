import { AppHeader } from "@/components/app-header";
import { PageMain, PageShell, SplitLayout } from "@/components/page-shell";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
    />
  );
}

function GhostShell({
  children,
  mainClassName,
  headerVariant = "app",
}: {
  children: React.ReactNode;
  mainClassName?: string;
  headerVariant?: "app" | "client";
}) {
  return (
    <PageShell className={headerVariant === "client" ? "bg-white" : undefined}>
      <AppHeader variant={headerVariant} />
      <PageMain className={mainClassName}>{children}</PageMain>
    </PageShell>
  );
}

function SidebarGhost() {
  return (
    <>
      <Bone className="h-10 w-full rounded-full" />
      <section className="space-y-2" aria-hidden>
        <Bone className="h-4 w-32" />
        <ul className="divide-y divide-border border-t border-border">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <Bone className="h-3 w-24 bg-muted/70" />
                <Bone className="h-3.5 w-full max-w-[12rem]" />
                <Bone className="h-3 w-16 bg-muted/60" />
              </div>
              <Bone className="h-10 w-[5.5rem] shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3" aria-hidden>
        <Bone className="h-4 w-28" />
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="space-y-1.5">
              <Bone className="h-3.5 w-full max-w-[16rem]" />
              <Bone className="h-3 w-28 bg-muted/70" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function GridTableGhost({ columns }: { columns: number }) {
  return (
    <div
      className="h-[min(70vh,640px)] w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card"
      aria-hidden
    >
      <div className="grid gap-px bg-border" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`h-${i}`} className="bg-[#ebeff5] px-3 py-3">
            <Bone className="h-3 w-16 bg-muted/80" />
          </div>
        ))}
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: columns }).map((_, col) => (
            <div
              key={`${row}-${col}`}
              className={cn(
                "px-3 py-4",
                row % 2 === 1 ? "bg-[#fafbfc]" : "bg-white",
              )}
            >
              <Bone
                className={cn(
                  "h-3.5",
                  col === 0 ? "w-24" : col === 1 ? "w-full max-w-[12rem]" : "w-20",
                )}
              />
            </div>
          )),
        )}
      </div>
    </div>
  );
}

/** Project detail: back link, title, agreement, request rows, sidebar. */
export function ProjectGhost() {
  return (
    <GhostShell>
      <SplitLayout
        mobileSidebarFirst
        main={
          <>
            <div className="space-y-2" aria-hidden>
              <Bone className="h-4 w-28 bg-muted/70" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Bone className="h-8 w-56 max-w-full" />
                  <Bone className="h-4 w-full max-w-md bg-muted/80" />
                </div>
                <Bone className="h-10 w-10 shrink-0 rounded-full" />
              </div>
            </div>

            <div className="border-b border-border py-4" aria-hidden>
              <Bone className="h-4 w-36" />
              <Bone className="mt-2 h-3.5 w-full max-w-lg bg-muted/80" />
            </div>

            <section className="space-y-1 pt-2" aria-hidden>
              <Bone className="h-4 w-20" />
              <ul className="border-t border-border">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 border-b border-border py-4"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <Bone className="h-5 w-52 max-w-full" />
                      <Bone className="h-3.5 w-28 bg-muted/80" />
                    </div>
                    <Bone className="h-10 w-20 shrink-0 rounded-full" />
                  </li>
                ))}
              </ul>
            </section>
          </>
        }
        sidebar={<SidebarGhost />}
      />
    </GhostShell>
  );
}

/** Review request: header + large decision card. */
export function ChangeReviewGhost() {
  return (
    <GhostShell>
      <div className="mb-6 space-y-3" aria-hidden>
        <Bone className="h-4 w-32 bg-muted/70" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Bone className="h-8 w-56 max-w-full" />
            <Bone className="h-4 w-40 bg-muted/80" />
          </div>
          <Bone className="h-8 w-28 rounded-full" />
        </div>
      </div>

      <section className="surface-card space-y-6 p-5 md:p-6" aria-hidden>
        <div className="space-y-2">
          <Bone className="h-3 w-24 bg-muted/70" />
          <Bone className="h-16 w-full rounded-xl bg-muted/80" />
        </div>
        <div className="space-y-2">
          <Bone className="h-6 w-48" />
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 border-b border-border py-4">
              <div className="flex items-start justify-between gap-3">
                <Bone className="h-5 w-64 max-w-[70%]" />
                <Bone className="h-9 w-28 rounded-full" />
              </div>
              <Bone className="h-3.5 w-full max-w-lg bg-muted/80" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Bone className="h-11 w-36 rounded-full" />
          <Bone className="h-11 w-28 rounded-full" />
        </div>
      </section>
    </GhostShell>
  );
}

/** AG Grid pages (operations / activity). */
export function OperationsGhost() {
  return (
    <GhostShell>
      <div className="mb-6 space-y-3" aria-hidden>
        <Bone className="h-4 w-28 bg-muted/70" />
        <Bone className="h-8 w-56" />
        <Bone className="h-4 w-full max-w-xl bg-muted/80" />
      </div>
      <GridTableGhost columns={6} />
    </GhostShell>
  );
}

export function ActivityGhost() {
  return (
    <GhostShell>
      <div className="mb-6 space-y-3" aria-hidden>
        <Bone className="h-4 w-28 bg-muted/70" />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Bone className="h-8 w-36" />
            <Bone className="h-4 w-full max-w-lg bg-muted/80" />
          </div>
          <Bone className="h-4 w-40 bg-muted/70" />
        </div>
      </div>
      <GridTableGhost columns={5} />
    </GhostShell>
  );
}

/** New project form card. */
export function NewProjectGhost() {
  return (
    <GhostShell mainClassName="max-w-3xl">
      <div className="mb-6 space-y-2" aria-hidden>
        <Bone className="h-4 w-28 bg-muted/70" />
        <Bone className="h-8 w-44" />
        <Bone className="h-4 w-full max-w-md bg-muted/80" />
      </div>
      <div className="surface-card space-y-5 p-5 md:p-6" aria-hidden>
        <div className="space-y-2">
          <Bone className="h-4 w-16" />
          <Bone className="h-11 w-full rounded-[0.875rem]" />
        </div>
        <div className="space-y-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-32 w-full rounded-[0.875rem]" />
        </div>
        <div className="space-y-2">
          <Bone className="h-4 w-28" />
          <Bone className="h-24 w-full rounded-[0.875rem]" />
        </div>
        <Bone className="h-11 w-36 rounded-full" />
      </div>
    </GhostShell>
  );
}

/** Client clarification thread. */
export function ThreadGhost() {
  return (
    <GhostShell headerVariant="client" mainClassName="max-w-lg space-y-4">
      <Bone className="h-3 w-28 bg-muted/70" />
      <Bone className="h-8 w-48" />
      <Bone className="h-4 w-full max-w-sm bg-muted/80" />
      <div className="surface-card space-y-4 p-5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-3 w-20 bg-muted/70" />
            <Bone className="h-14 w-full rounded-xl" />
          </div>
        ))}
        <Bone className="h-11 w-full rounded-full" />
      </div>
    </GhostShell>
  );
}

/** Client proposal link. */
export function ProposalGhost() {
  return (
    <GhostShell headerVariant="client" mainClassName="max-w-2xl space-y-6">
      <div className="space-y-3" aria-hidden>
        <Bone className="h-3 w-24 bg-muted/70" />
        <Bone className="h-8 w-52" />
      </div>
      <div className="surface-card space-y-4 p-6" aria-hidden>
        <Bone className="h-5 w-40" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-full max-w-sm bg-muted/80" />
        <Bone className="h-24 w-full rounded-xl" />
        <Bone className="h-12 w-full rounded-full" />
      </div>
    </GhostShell>
  );
}
