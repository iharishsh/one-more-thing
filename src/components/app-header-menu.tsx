"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeaderMenu() {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open menu"
        className="inline-flex size-10 items-center justify-center rounded-full text-foreground outline-none transition-colors hover:bg-[color:var(--brand-soft)] focus-visible:ring-3 focus-visible:ring-ring/35"
      >
        <svg
          width="22"
          height="16"
          viewBox="0 0 22 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M1 1.5h20M1 8h20M1 14.5h20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 p-1.5">
        <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5 text-base">
          <Link href="/workspace/operations">Changes &amp; Payments</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-lg px-3 py-2.5 text-base text-[color:var(--brand)]"
          onSelect={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            // Full navigation so no cached signed-in route data survives logout.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/login");
          }}
        >
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
