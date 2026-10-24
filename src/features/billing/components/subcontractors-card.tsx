"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Sub = { id: string; name: string; paypalEmail: string; sharePercent: number };

export function SubcontractorsCard({
  projectId,
  subcontractors,
}: {
  projectId: string;
  subcontractors: Sub[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/subcontractors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || "").trim(),
          paypalEmail: String(formData.get("paypalEmail") || "").trim(),
          sharePercent: Number(formData.get("sharePercent")),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not add subcontractor");
        return;
      }
      setAdding(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/subcontractors?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Could not remove");
      router.refresh();
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-normal">Subcontractors</h2>
      <p className="text-xs tracking-body text-muted-foreground">
        When a client pays for a change, AI drafts each person&apos;s share as
        a PayPal payout for you to approve.
      </p>
      {subcontractors.length ? (
        <ul className="divide-y divide-border border-t border-border text-sm">
          {subcontractors.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.name} · {s.sharePercent}%
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.paypalEmail}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => remove(s.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <form action={add} className="space-y-2">
          <Input name="name" placeholder="Name" aria-label="Name" required />
          <Input
            name="paypalEmail"
            type="email"
            placeholder="Their PayPal email"
            aria-label="PayPal email"
            required
          />
          <Input
            name="sharePercent"
            type="number"
            min={1}
            max={90}
            placeholder="Share of each paid change (%)"
            aria-label="Share percent"
            required
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          Add subcontractor
        </Button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
