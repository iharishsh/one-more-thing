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
    <article className="flex items-center justify-between gap-4 border-b border-border py-4">
      <div className="min-w-0 space-y-0.5">
        <h3 className="truncate text-lg font-semibold tracking-[-0.04em] text-foreground font-[family-name:var(--font-plain)]">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{meta}</p>
      </div>
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0 no-underline",
        )}
      >
        Open
      </Link>
    </article>
  );
}
