import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({
  href = "/",
  showWordmark = true,
  className,
  size = 40,
  compactOnMobile = false,
}: {
  href?: string | null;
  showWordmark?: boolean;
  className?: string;
  size?: number;
  compactOnMobile?: boolean;
}) {
  const mark = (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 sm:gap-3",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand-logo.svg"
        alt=""
        width={size}
        height={size}
        className={cn(
          "shrink-0",
          compactOnMobile && "size-8 sm:size-10",
        )}
      />
      {showWordmark ? (
        <span
          className={cn(
            "truncate font-[family-name:var(--font-plain)] font-medium leading-tight tracking-[-0.05em] text-foreground [word-spacing:0.12em]",
            compactOnMobile
              ? "text-base sm:text-xl md:text-[2rem]"
              : "text-[2rem]",
          )}
        >
          One More Thing
        </span>
      ) : (
        <span className="sr-only">One More Thing</span>
      )}
    </span>
  );

  if (!href) return mark;

  return (
    <Link
      href={href}
      className="text-foreground no-underline hover:text-foreground"
    >
      {mark}
    </Link>
  );
}
