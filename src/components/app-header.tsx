import Link from "next/link";
import { AppHeaderMenu } from "@/components/app-header-menu";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeaderVariant = "marketing" | "app" | "client";

export function AppHeader({
  variant = "app",
  className,
}: {
  variant?: HeaderVariant;
  className?: string;
}) {
  if (variant === "marketing") {
    return (
      <header
        className={cn(
          "relative z-20 border-b border-transparent bg-white",
          className,
        )}
      >
        <div className="page-container flex h-16 items-center justify-between gap-3 md:h-20 md:gap-4">
          <BrandLogo />
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "secondary", size: "default" }),
                "no-underline",
              )}
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "no-underline",
              )}
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  if (variant === "client") {
    return (
      <header className={cn("border-b border-border bg-card", className)}>
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <BrandLogo href={null} />
          <p className="text-sm tracking-body text-muted-foreground">
            sandbox - no real money
          </p>
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-card",
        className,
      )}
    >
      <div className="page-container flex h-14 items-center justify-between gap-2 sm:h-16 md:h-20 md:gap-4">
        <BrandLogo href="/workspace" compactOnMobile />
        <nav className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <Link
            href="/workspace/operations"
            className={cn(
              buttonVariants({ variant: "secondary", size: "default" }),
              "hidden no-underline sm:inline-flex",
            )}
          >
            Changes &amp; Payments
          </Link>
          <LogoutButton className="hidden sm:inline-flex" />
          <div className="sm:hidden">
            <AppHeaderMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
