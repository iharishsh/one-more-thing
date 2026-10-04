"use client";

import { useEffect, useState, useTransition } from "react";
import { ProductThumb } from "@/features/products/components/product-thumb";
import type { QuoteLine, SourcedProduct } from "@/features/products/product.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/money";

export function ProductsMaterialsPicker({
  lines,
  onChange,
}: {
  lines: QuoteLine[];
  onChange: (lines: QuoteLine[]) => void;
}) {
  const [configured, setConfigured] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SourcedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/products/search")
      .then((r) => r.json())
      .then((d) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  function search() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 5 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      setResults(data.products ?? []);
    });
  }

  function attach(product: SourcedProduct) {
    const amount = product.priceCentsEstimate ?? 0;
    onChange([
      ...lines,
      {
        kind: "product",
        label: product.title,
        amountCents: amount,
        estimate: true,
        product: {
          id: product.id,
          title: product.title,
          imageUrl: product.imageUrl,
          priceCentsEstimate: product.priceCentsEstimate,
          buyUrl: product.buyUrl,
          retailer: product.retailer,
          retrievedAt: product.retrievedAt,
        },
      },
    ]);
  }

  function addLabourLine() {
    onChange([
      ...lines,
      {
        kind: "labour",
        label: "Handling / labour",
        amountCents: 0,
        estimate: false,
        product: null,
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<QuoteLine>) {
    const next = lines.map((line, i) =>
      i === index ? { ...line, ...patch } : line,
    );
    onChange(next);
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold tracking-normal">
          Products & materials (optional)
        </h4>
        <p className="text-xs tracking-body text-muted-foreground">
          Attach sourced products when the change requires buying something.
          Retail prices are estimates until you verify. PayPal payment to you
          does not order from the retailer.
        </p>
      </div>

      {!configured ? (
        <p className="text-xs text-muted-foreground">
          Set <code>CHANNEL3_API_KEY</code> to enable live product search
          (hackathon promo <code>PAYPAL-HACKATHON-2026</code>).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products from client requirements…"
            className="min-w-[220px] flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || query.trim().length < 2}
            onClick={search}
          >
            {pending ? "Searching…" : "Search"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={addLabourLine}>
            Add labour line
          </Button>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2 text-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ProductThumb src={p.imageUrl} alt={p.title} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.retailer ?? "Retailer"}
                    {p.priceCentsEstimate != null
                      ? ` · est. ${formatUsd(p.priceCentsEstimate)}`
                      : ""}
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" onClick={() => attach(p)}>
                Attach
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {lines.length > 0 ? (
        <div className="space-y-2">
          <Label>Quote lines</Label>
          <ul className="space-y-2">
            {lines.map((line, index) => (
              <li
                key={`${line.label}-${index}`}
                className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[auto_1fr_120px_auto] sm:items-center"
              >
                <ProductThumb
                  src={line.product?.imageUrl}
                  alt={line.label}
                  size="sm"
                  fallback={line.kind === "labour" ? "Lab" : "—"}
                />
                <Input
                  value={line.label}
                  onChange={(e) =>
                    updateLine(index, { label: e.target.value })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={(line.amountCents / 100).toFixed(2)}
                  onChange={(e) =>
                    updateLine(index, {
                      amountCents: Math.round(Number(e.target.value) * 100),
                      estimate: line.kind === "product" ? true : line.estimate,
                    })
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeLine(index)}
                >
                  Remove
                </Button>
                <p className="text-xs text-muted-foreground sm:col-span-4">
                  {line.kind}
                  {line.estimate ? " · estimate" : ""}
                  {line.product?.buyUrl ? (
                    <>
                      {" · "}
                      <a href={line.product.buyUrl} target="_blank" rel="noreferrer">
                        source link
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
