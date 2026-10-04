import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProjectCard({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta: string;
}) {
  return (
    <article className="surface-project flex min-h-[9.5rem] flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
      <div className="relative z-10 min-w-0 space-y-1.5">
        <h3 className="truncate text-[1.75rem] font-bold leading-tight tracking-[-0.09em] text-foreground font-[family-name:var(--font-plain)] [word-spacing:0.1em]">
          {title}
        </h3>
        <p className="text-base leading-snug tracking-[-0.04em] text-muted-foreground">
          {meta}
        </p>
      </div>
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: "outline", size: "default" }),
          "relative z-10 shrink-0 self-start no-underline sm:self-center",
        )}
      >
        View project
      </Link>
    </article>
  );
}
