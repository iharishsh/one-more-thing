import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default: "bg-[color:var(--brand-soft)] text-[color:var(--brand)]",
  clarify: "bg-[#fff4c2] text-[#5c4b00]",
  included: "bg-[#e5f6e8] text-[#0f5c2e]",
  additional: "bg-[#e3f0ff] text-[color:var(--brand)]",
  paid: "bg-[#e5f6e8] text-[#0f5c2e]",
  warning: "bg-[#fff4c2] text-[#5c4b00]",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-body",
        styles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
