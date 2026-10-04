import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  id: string;
  projectTitle: string;
  summary: string;
  statusLabel: string;
  href: string;
};

export function AttentionPanel({
  items,
  className,
}: {
  items: AttentionItem[];
  className?: string;
}) {
  return (
    <section
      className={cn("surface-attention space-y-3 p-4", className)}
      aria-label="Needs attention"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-heading font-[family-name:var(--font-plain)]">
          Needs attention · {items.length}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] bg-white/70 px-3 py-3 text-sm text-foreground/80">
          Nothing waiting. Add a client request when something new comes in.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-lg)] bg-white p-3 shadow-none"
            >
              <div className="space-y-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {item.projectTitle}
                  </p>
                  <p className="text-base font-bold tracking-heading text-foreground font-[family-name:var(--font-plain)]">
                    {item.summary}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {item.statusLabel}
                  </p>
                  <Link
                    href={item.href}
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "no-underline",
                    )}
                  >
                    Review
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
