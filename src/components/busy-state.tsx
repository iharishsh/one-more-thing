import { Spinner } from "@/components/spinner";
import { cn } from "@/lib/utils";

/** Inline status under a form control while an API call runs. */
export function BusyHint({
  active,
  title,
  detail,
  className,
}: {
  active: boolean;
  title: string;
  detail?: string;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--brand)]/20 bg-[color:var(--brand-soft)] px-3 py-3 text-sm text-foreground",
        className,
      )}
    >
      <Spinner className="mt-0.5 text-[color:var(--brand)]" label={title} />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium tracking-normal">{title}</p>
        {detail ? (
          <p className="text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Soft overlay so the page still feels responsive while work runs. */
export function BusyOverlay({
  active,
  title,
  detail,
}: {
  active: boolean;
  title: string;
  detail?: string;
}) {
  if (!active) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-background/55 px-4 pt-[20vh] backdrop-blur-[1px]"
      role="alertdialog"
      aria-busy="true"
      aria-label={title}
    >
      <div className="flex max-w-sm items-start gap-3 rounded-[var(--radius-xl)] border border-border bg-card px-4 py-3 shadow-lg">
        <Spinner className="mt-0.5 text-[color:var(--brand)]" label={title} />
        <div className="space-y-0.5">
          <p className="text-sm font-medium tracking-normal">{title}</p>
          {detail ? (
            <p className="text-xs text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
