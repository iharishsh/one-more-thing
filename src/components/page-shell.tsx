import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-dvh bg-background", className)}>{children}</div>
  );
}

export function PageMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("page-container py-8 md:py-10", className)}>
      {children}
    </main>
  );
}

/** Main content + optional right sidebar. Stacks on mobile: actions/attention first when `mobileSidebarFirst`. */
export function SplitLayout({
  main,
  sidebar,
  mobileSidebarFirst = false,
  className,
}: {
  main: React.ReactNode;
  sidebar?: React.ReactNode;
  mobileSidebarFirst?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--sidebar-width)] lg:gap-8",
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0",
          mobileSidebarFirst && "order-2 lg:order-1",
        )}
      >
        <Card className="gap-0 rounded-[2.25rem] py-0 ring-border/80">
          <CardContent className="space-y-6 p-5 md:p-6">{main}</CardContent>
        </Card>
      </div>
      {sidebar ? (
        <aside
          className={cn(
            "min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start",
            mobileSidebarFirst && "order-1 lg:order-2",
          )}
        >
          {sidebar}
        </aside>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        <h1 className="text-heading text-foreground">{title}</h1>
        {description ? (
          <div className="max-w-2xl text-base tracking-body text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-border bg-card px-5 py-8 text-center">
      <p className="font-semibold tracking-body text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
