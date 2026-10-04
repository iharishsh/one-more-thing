"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const STATUSES = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatusValue[];

export function ProjectSettingsForm({
  projectId,
  title: initialTitle,
  status: initialStatus,
  onSaved,
}: {
  projectId: string;
  title: string;
  status: ProjectStatusValue;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<ProjectStatusValue>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update project");
        return;
      }
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-title">Project title</Label>
        <Input
          id="project-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-status">Status</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as ProjectStatusValue)}
        >
          <SelectTrigger id="project-status" className="h-11 w-full rounded-full px-4">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="outline" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save project settings"}
      </Button>
    </form>
  );
}
