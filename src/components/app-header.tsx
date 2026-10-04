import Link from "next/link";
import { AppHeaderMenu } from "@/components/app-header-menu";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { Spinner } from "@/components/spinner";
import { buttonVariants } from "@/components/ui/button";
import type { AuthBusyMode } from "@/lib/auth-exit";
import { cn } from "@/lib/utils";

type HeaderVariant = "marketing" | "app" | "client";

export function AppHeader({
  variant = "app",
  className,
  authBusy = null,
}: {
  variant?: HeaderVariant;
  className?: string;
  /** While signing in/up from marketing auth — lights up the matching nav control. */
  authBusy?: AuthBusyMode;
}) {
  if (variant === "marketing") {
    const loginBusy = authBusy === "login";
    const signupBusy = authBusy === "signup";

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
            {loginBusy ? (
              <span
                className={cn(
                  buttonVariants({ variant: "secondary", size: "default" }),
                  "pointer-events-none gap-2",
                )}
                aria-live="polite"
              >
                <Spinner className="size-3.5" label="Signing in" />
                Signing in…
              </span>
            ) : (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "default" }),
                  "no-underline",
                  signupBusy && "pointer-events-none opacity-50",
                )}
                aria-disabled={signupBusy || undefined}
                tabIndex={signupBusy ? -1 : undefined}
              >
                Log In
              </Link>
            )}
            {signupBusy ? (
              <span
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "pointer-events-none gap-2",
                )}
                aria-live="polite"
              >
                <Spinner className="size-3.5 text-white" label="Creating account" />
                Creating…
              </span>
            ) : (
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "no-underline",
                  loginBusy && "pointer-events-none opacity-50",
                )}
                aria-disabled={loginBusy || undefined}
                tabIndex={loginBusy ? -1 : undefined}
              >
                Sign Up
              </Link>
            )}
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
