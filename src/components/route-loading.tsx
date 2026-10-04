import { Spinner } from "@/components/spinner";

/** Shown by Next.js `loading.tsx` during server navigations. */
export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-5 text-[color:var(--brand)]" label={label} />
      <p>{label}</p>
    </div>
  );
}
