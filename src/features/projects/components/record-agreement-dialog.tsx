"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";

function todayInputValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function RecordAgreementDialog({
  projectId,
  openingRequest,
  triggerLabel = "Record existing agreement",
  triggerVariant = "brand" as const,
  open: controlledOpen,
  onOpenChange,
}: {
  projectId: string;
  openingRequest?: string | null;
  triggerLabel?: string;
  triggerVariant?: "brand" | "outline" | "default";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [scope, setScope] = useState(openingRequest?.trim() || "");
  const [source, setSource] = useState("");
  const [dateText, setDateText] = useState(todayInputValue());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      if (!scope.trim()) {
        setError("Enter what you already agreed");
        return;
      }
      if (!source.trim()) {
        setError("Say where this was agreed (email, call, contract…)");
        return;
      }
      const recordedAt = new Date(`${dateText}T12:00:00`);
      if (Number.isNaN(recordedAt.getTime())) {
        setError("Enter a valid date");
        return;
      }

      const res = await fetch(`/api/projects/${projectId}/record-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentScope: scope.trim(),
          agreementSource: source.trim(),
          agreementRecordedAt: recordedAt.toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save agreement");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen == null ? (
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant={triggerVariant}>
            {triggerLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record existing agreement</DialogTitle>
          <DialogDescription>
            Write down what you already agreed outside this app. This is labeled
            as recorded by you — not client acceptance in the app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rec-scope">What’s agreed</Label>
            <Textarea
              id="rec-scope"
              rows={6}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Deliverables, revisions, what’s out of scope…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rec-source">Where / how</Label>
              <Input
                id="rec-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Email thread, signed PDF, call…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-date">Agreed on</Label>
              <Input
                id="rec-date"
                type="date"
                value={dateText}
                onChange={(e) => setDateText(e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <BusyHint
            active={pending}
            title="Saving…"
            detail="Recording the agreement as your baseline."
          />
          <Button type="button" variant="brand" disabled={pending} onClick={submit}>
            {pending ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              "Save agreement"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
