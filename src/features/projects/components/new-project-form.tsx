"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [originalScope, setOriginalScope] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [pending, startTransition] = useTransition();
  const [refining, startRefine] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const list = deliverables
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((t) => ({ title: t }));

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          originalScope,
          deliverables: list,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create project");
        return;
      }
      router.push(`/workspace/projects/${data.project.id}`);
      router.refresh();
    });
  }

  function onRefine() {
    setError(null);
    setHint(null);
    startRefine(async () => {
      const res = await fetch("/api/projects/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          originalScope,
          deliverablesText: deliverables,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to refine draft");
        return;
      }
      const draft = data.draft as {
        title: string;
        originalScope: string;
        deliverables: string[];
        notes?: string;
        source?: string;
      };
      setTitle(draft.title);
      setOriginalScope(draft.originalScope);
      setDeliverables(draft.deliverables.join("\n"));
      setHint(
        draft.notes ||
          (draft.source === "fallback"
            ? "Structured locally — review before creating."
            : "Draft refined — review and edit before creating."),
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Project title</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Landing page redesign"
        />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Label htmlFor="originalScope">Original agreed scope</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refining || pending}
            onClick={onRefine}
          >
            {refining ? "Refining…" : "AI refine"}
          </Button>
        </div>
        <Textarea
          id="originalScope"
          name="originalScope"
          required
          rows={10}
          value={originalScope}
          onChange={(e) => setOriginalScope(e.target.value)}
          placeholder="Paste rough notes or a short brief — then use AI refine to structure What’s included, deliverables, revisions, and exclusions."
        />
        <p className="text-xs text-muted-foreground">
          Add a title or a few notes first. AI refine clarifies structure — it
          won’t invent prices or work you didn’t mention.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deliverables">Deliverables (one per line)</Label>
        <Textarea
          id="deliverables"
          name="deliverables"
          rows={4}
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
          placeholder={"Hero section\nFeatures section\nContact form"}
        />
      </div>
      {hint ? (
        <p className="rounded-[var(--radius-lg)] bg-[color:var(--brand-soft)] px-3 py-2 text-sm text-foreground">
          {hint}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="brand" disabled={pending || refining}>
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
