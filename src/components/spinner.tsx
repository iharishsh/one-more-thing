import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
  label,
}: {
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}) {
  return (
    <Loader2Icon
      className={cn("size-4 shrink-0 animate-spin", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  );
}
