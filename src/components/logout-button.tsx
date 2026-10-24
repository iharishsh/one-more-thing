"use client";

import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  children = "Log Out",
}: {
  className?: string;
  children?: React.ReactNode;
}) {

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center font-[family-name:var(--font-plain)] text-base font-semibold leading-tight tracking-[-0.09em] text-[color:var(--brand)] hover:text-[color:var(--brand-bright)]",
        className,
      )}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // Full navigation so no cached signed-in route data survives logout.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/login");
      }}
    >
      {children}
    </button>
  );
}
