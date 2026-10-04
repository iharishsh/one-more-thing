import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-white">
      <AppHeader variant="marketing" />

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-[72rem] flex-1 flex-col items-center overflow-hidden px-6 pb-[min(32vh,260px)] pt-10 md:pt-16">
        <div className="motion-arrive flex w-full max-w-[65rem] flex-col items-center text-center">
          <h1 className="text-display text-black">One More Thing!</h1>
          <p className="text-lead mt-6 max-w-[40rem] text-black md:max-w-[52rem]">
            When the client asks for one more thing, ship a clear proposal,
            get a yes, and get paid - AI sorts what&apos;s in scope, you set the
            price.
          </p>
          <Link
            href="/workspace"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "mt-10 h-14 min-h-14 px-8 text-2xl font-normal tracking-[-0.04em] no-underline",
            )}
          >
            <span className="leading-none">Open workspace</span>
          </Link>
          <p className="mt-3 text-sm tracking-body text-muted-foreground">
            sandbox - no real money
          </p>
        </div>
      </main>

      {/* Tall shape, bottom clipped by shell; slides up on load */}
      <div
        aria-hidden
        className="motion-hero-band pointer-events-none absolute inset-x-0 bottom-0 z-0 mx-auto h-[min(62vh,480px)] w-[min(calc(100%-1.5rem),71.7rem)] rounded-t-[36px] bg-[color:var(--brand-accent)]"
      />
    </div>
  );
}
