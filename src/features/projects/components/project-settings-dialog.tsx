"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectSettingsForm } from "@/features/projects/components/project-settings-form";
import type { ProjectStatusValue } from "@/features/projects/project.schema";

export function ProjectSettingsDialog({
  projectId,
  title,
  status,
}: {
  projectId: string;
  title: string;
  status: ProjectStatusValue;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Project settings"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-[color:var(--brand-soft)] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <path
              d="M19.4 13a7.8 7.8 0 0 0 .05-2l2.05-1.6-2-3.46-2.45.9a7.7 7.7 0 0 0-1.73-1L14.9 2h-5.8L8.68 4.84a7.7 7.7 0 0 0-1.73 1l-2.45-.9-2 3.46L4.55 11a7.8 7.8 0 0 0 0 2l-2.05 1.6 2 3.46 2.45-.9a7.7 7.7 0 0 0 1.73 1L9.1 22h5.8l.42-2.84a7.7 7.7 0 0 0 1.73-1l2.45.9 2-3.46L19.4 13Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-[var(--radius-xl)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            Update the project title and status. Status controls the workspace
            filter (Active is the default list).
          </DialogDescription>
        </DialogHeader>
        <ProjectSettingsForm
          projectId={projectId}
          title={title}
          status={status}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
