"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function ProductThumb({
  src,
  alt = "",
  size = "md",
  fallback,
  className,
}: {
  src: string | null | undefined;
  alt?: string;
  size?: "sm" | "md";
  fallback?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const box = size === "sm" ? "size-12" : "size-14";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (!src) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg bg-[color:var(--brand-soft)]",
          box,
          className,
        )}
      >
        <span className="flex size-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {fallback ?? "No img"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative shrink-0", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Preview product image"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "relative block overflow-hidden rounded-lg bg-[color:var(--brand-soft)] outline-none ring-offset-2 transition focus-visible:ring-3 focus-visible:ring-ring/35",
          box,
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external Channel3 / retailer URLs */}
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className="pointer-events-none absolute top-0 left-full z-50 ml-2 w-44 origin-left animate-in fade-in-0 zoom-in-95 rounded-xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/10 duration-150 sm:w-52"
        >
          <div className="overflow-hidden rounded-lg bg-[color:var(--brand-soft)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="aspect-square w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
