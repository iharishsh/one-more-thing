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
import { Input } from "@/components/ui/input";
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
  const [destination, setDestination] = useState<"current" | "new">("current");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsProjectPicker =
    destination === "current" &&
    !defaultProjectId &&
    projects.length > 1;
  const canSubmit = Boolean(
    message.trim() &&
      (destination === "new"
        ? newProjectTitle.trim()
        : projectId || defaultProjectId),
  );

  const emptyHint = useMemo(() => {
    if (projects.length === 0 && destination === "current") {
      return "Create a project before adding a request, or choose a new project.";
    }
    return null;
  }, [projects.length, destination]);

  function reset() {
    setMessage("");
    setNotes("");
    setPriceText("");
    setDeliveryNote("");
    setShowNotes(false);
    setShowTerms(false);
    setDestination("current");
    setNewProjectTitle("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const priceCents =
        priceText.trim() === ""
          ? undefined
          : Math.round(Number.parseFloat(priceText) * 100);
      if (priceText.trim() && (!Number.isFinite(priceCents) || priceCents! < 0)) {
        setError("Price must be a valid dollar amount");
        return;
      }

      let targetProjectId = defaultProjectId || projectId;

      if (destination === "new") {
        const title = newProjectTitle.trim();
        if (!title) {
          setError("Name the new project");
          return;
        }
        const projectRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            agreementStatus: "UNCONFIRMED",
            openingRequest: message.trim(),
            originalScope: message.trim(),
            deliverables: [],
          }),
        });
        const projectData = await projectRes.json();
        if (!projectRes.ok) {
          setError(projectData.error ?? "Could not create project");
          return;
        }
        targetProjectId = projectData.project.id as string;
      }

      if (!targetProjectId) {
        setError("Choose a project");
        return;
      }

      const res = await fetch("/api/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: targetProjectId,
          clientMessage: message.trim(),
          discussionNotes: notes.trim() || undefined,
          discussedPriceCents: priceCents,
          discussedDeliveryNote: deliveryNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to prepare decision");
        return;
      }
      setOpen(false);
      reset();
      router.push(
        `/workspace/projects/${targetProjectId}/changes/${data.change.id}`,
      );
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          className="w-full"
          disabled={projects.length === 0 && destination === "current"}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[var(--radius-xl)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add client request</DialogTitle>
          <DialogDescription>
            Paste what they asked. Add call or chat notes if you already have
            answers.
          </DialogDescription>
        </DialogHeader>

        {emptyHint && destination === "current" ? (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="destination">Where should this go?</Label>
              {needsProjectPicker || !defaultProjectId ? (
                <Select
                  value={destination === "new" ? "__new__" : projectId}
                  onValueChange={(next) => {
                    if (next === "__new__") {
                      setDestination("new");
                      return;
                    }
                    setDestination("current");
                    setProjectId(next);
                  }}
                >
                  <SelectTrigger
                    id="destination"
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
                    <SelectItem value="__new__">Create new project…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={destination === "current" ? "brand" : "outline"}
                    onClick={() => {
                      setDestination("current");
                      setNewProjectTitle("");
                    }}
                    disabled={projects.length === 0}
                  >
                    Existing project
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={destination === "new" ? "brand" : "outline"}
                    onClick={() => {
                      setDestination("new");
                      setNewProjectTitle("");
                    }}
                  >
                    Create new project…
                  </Button>
                </div>
              )}
            </div>

            {destination === "new" ? (
              <div className="space-y-2">
                <Label htmlFor="newProjectTitle">New project title</Label>
                <Input
                  id="newProjectTitle"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="Name this job (match the request)"
                />
                <p className="text-xs text-muted-foreground">
                  Starts a new project from this request. Next you’ll record an
                  existing agreement or prepare a first proposal.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="clientMessage">Client request</Label>
              <Textarea
                id="clientMessage"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Paste the request from email, Slack, or a message…"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                className="text-sm font-medium text-[color:var(--brand)]"
                onClick={() => setShowNotes((v) => !v)}
              >
                {showNotes ? "Hide discussion notes" : "Add discussion notes"}
              </button>
              {showNotes ? (
                <div className="space-y-2">
                  <Label htmlFor="discussionNotes">
                    Discussion notes (your notes — not acceptance)
                  </Label>
                  <Textarea
                    id="discussionNotes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What you already clarified on a call, WhatsApp, or email…"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                className="text-sm font-medium text-[color:var(--brand)]"
                onClick={() => setShowTerms((v) => !v)}
              >
                {showTerms
                  ? "Hide price / delivery discussed"
                  : "Price or delivery already discussed"}
              </button>
              {showTerms ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="discussedPrice">Price discussed (USD)</Label>
                    <Input
                      id="discussedPrice"
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceText}
                      onChange={(e) => setPriceText(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discussedDelivery">Delivery note</Label>
                    <Input
                      id="discussedDelivery"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Optional timing"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <BusyHint
              active={pending}
              title="Preparing decision…"
              detail="Comparing this conversation with the agreement."
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
                  Preparing…
                </>
              ) : (
                "Prepare decision"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
