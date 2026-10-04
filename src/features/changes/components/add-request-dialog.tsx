"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BusyHint } from "@/components/busy-state";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ProjectOption = { id: string; title: string };

export function AddRequestDialog({
  projects,
  defaultProjectId,
  triggerLabel = "Add request",
  triggerVariant = "brand" as const,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  triggerLabel?: string;
  triggerVariant?: "brand" | "outline" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsProjectPicker = !defaultProjectId && projects.length > 1;
  const canSubmit = Boolean(projectId && message.trim());

  const emptyHint = useMemo(() => {
    if (projects.length === 0) return "Create a project before adding a request.";
    return null;
  }, [projects.length]);

  function submit() {
    setError(null);
    if (!projectId) {
      setError("Choose a project");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clientMessage: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to analyze request");
        return;
      }
      setOpen(false);
      setMessage("");
      router.push(
        `/workspace/projects/${projectId}/changes/${data.change.id}`,
      );
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          className="w-full"
          disabled={projects.length === 0}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[var(--radius-xl)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add client request</DialogTitle>
          <DialogDescription>
            Paste what the client asked. You’ll review the classification next.
          </DialogDescription>
        </DialogHeader>

        {emptyHint ? (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="space-y-4">
            {needsProjectPicker || !defaultProjectId ? (
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger
                    id="project"
                    className="h-11 w-full rounded-full px-4"
                  >
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="clientMessage">Client message</Label>
              <Textarea
                id="clientMessage"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Paste the request from email, Slack, or notes…"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <BusyHint
              active={pending}
              title="Analyzing…"
              detail="AI is reviewing this against the agreement. Hang tight."
            />
            <Button
              type="button"
              variant="brand"
              disabled={pending || !canSubmit}
              onClick={submit}
              className="w-full"
            >
              {pending ? (
                <>
                  <Spinner />
                  Analyzing…
                </>
              ) : (
                "Analyze request"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
