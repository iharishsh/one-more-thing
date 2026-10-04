import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="relative z-10 mx-auto flex w-full max-w-[72rem] flex-col items-center px-6 pb-8 pt-10 md:pb-10 md:pt-16">
      <div className="motion-arrive flex w-full max-w-[65rem] flex-col items-center text-center">
        <h1 className="text-display text-black">One More Thing!</h1>
        <p className="text-lead mt-6 max-w-[40rem] text-black md:max-w-[52rem]">
          When the client asks for one more thing, ship a clear proposal, get a
          yes, and get paid - AI sorts what&apos;s in scope, you set the price.
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
  );
}
