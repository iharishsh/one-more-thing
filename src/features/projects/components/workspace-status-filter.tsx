"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROJECT_STATUS_LABELS,
  type ProjectStatusValue,
} from "@/features/projects/project.schema";

const OPTIONS: Array<{ value: "ALL" | ProjectStatusValue; label: string }> = [
  { value: "ACTIVE", label: PROJECT_STATUS_LABELS.ACTIVE },
  { value: "ON_HOLD", label: PROJECT_STATUS_LABELS.ON_HOLD },
  { value: "COMPLETED", label: PROJECT_STATUS_LABELS.COMPLETED },
  { value: "ARCHIVED", label: PROJECT_STATUS_LABELS.ARCHIVED },
  { value: "ALL", label: "All" },
];

export function WorkspaceStatusFilter({
  value = "ACTIVE",
}: {
  value?: "ALL" | ProjectStatusValue;
}) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === "ACTIVE") router.push("/workspace");
        else router.push(`/workspace?status=${next}`);
      }}
    >
      <SelectTrigger
        aria-label="Filter projects by status"
        size="default"
        className="h-11 w-auto min-w-[8.5rem] rounded-full border-0 bg-[color:var(--brand-soft)] px-4 text-sm font-medium tracking-[-0.04em] shadow-none focus-visible:ring-ring/35"
      >
        <SelectValue placeholder="Active" />
      </SelectTrigger>
      <SelectContent align="end" position="popper">
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
