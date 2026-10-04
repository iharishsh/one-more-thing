"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  children = "Log Out",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center font-[family-name:var(--font-plain)] text-base font-semibold leading-tight tracking-[-0.09em] text-[color:var(--brand)] hover:text-[color:var(--brand-bright)]",
        className,
      )}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      {children}
    </button>
  );
}
