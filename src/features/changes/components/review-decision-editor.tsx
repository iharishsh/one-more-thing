"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisResult, Finding } from "@/features/changes/analysis.schema";
import type { QuoteLine } from "@/features/products/product.schema";
import { ProductsMaterialsPicker } from "@/features/products/components/products-materials-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/money";

const OUTCOME_LABEL: Record<AnalysisResult["primaryOutcome"], string> = {
  clarify: "Needs clarification",
  included: "Likely included",
  additional: "Suggested additional work",
  mixed: "Mixed — review carefully",
};

const CLASS_LABEL = {
  included: "Already included",
  additional: "Suggested extra work",
  unclear: "Needs clarification",
} as const;

type Bucket = keyof typeof CLASS_LABEL;

function SourceBanner({ analysis }: { analysis: AnalysisResult }) {
  if (analysis.source === "fallback") {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Analysis unavailable — needs manual review.</p>
        <p className="mt-1 text-amber-900/80">
          {analysis.sourceDetail ??
            "The AI run failed. Nothing below is an automatic included/additional classification or price."}
        </p>
      </div>
    );
  }
  if (analysis.source === "ai") {
    return (
      <p className="text-sm text-muted-foreground">
        AI suggestion ready for your review. Quotes prove the words exist —
        they do not prove the classification is correct.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Needs manual review</p>
      <p className="mt-1 text-muted-foreground">
        Offline mode preserves the request and agreement. Classify included vs
        additional work yourself — no automatic price or billable conclusion.
      </p>
    </div>
  );
}

function FindingCard({
  bucket,
  item,
  onChange,
  locked,
}: {
  bucket: Bucket;
  item: Finding;
  onChange: (next: Finding) => void;
  locked?: boolean;
}) {
  return (
    <article className="space-y-3 border-b border-border pb-5 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold tracking-normal text-foreground">
          {item.claim}
        </h3>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {CLASS_LABEL[bucket]}
        </span>
      </div>

      <dl className="space-y-2 text-sm tracking-body">
        <div>
          <dt className="text-muted-foreground">Client</dt>
          <dd className="mt-0.5">“{item.quote || "—"}”</dd>
        </div>
        {item.agreementQuote ? (
          <div>
            <dt className="text-muted-foreground">Agreement</dt>
            <dd className="mt-0.5">“{item.agreementQuote}”</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Why</dt>
          <dd className="mt-0.5">{item.reason}</dd>
        </div>
        {bucket === "unclear" && item.clarificationQuestion ? (
          <div>
            <dt className="text-muted-foreground">Suggested question</dt>
            <dd className="mt-0.5">{item.clarificationQuestion}</dd>
          </div>
        ) : null}
      </dl>

      {locked ? null : (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Freelancer correction
          </Label>
          <Textarea
            rows={2}
            value={item.claim}
            onChange={(e) => onChange({ ...item, claim: e.target.value })}
          />
        </div>
      )}
    </article>
  );
}

export function ReviewDecisionEditor({
  changeId,
  analysis,
  agreementScope,
  locked = false,
}: {
  changeId: string;
  analysis: AnalysisResult;
  agreementScope: string;
  /** True when a proposal on this request already has a captured payment */
  locked?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(analysis);
  const [mode, setMode] = useState<"clarify" | "included" | "propose">(
    analysis.primaryOutcome === "additional"
      ? "propose"
      : analysis.primaryOutcome === "included"
        ? "included"
        : "clarify",
  );

  const firstUnclear = draft.unclear[0];
  const [clarifyQuestion, setClarifyQuestion] = useState(
    firstUnclear?.clarificationQuestion ??
      "Could you clarify what you mean so I can confirm whether this is included or new work?",
  );
  const [copied, setCopied] = useState(false);

  const [addedWork, setAddedWork] = useState(
    draft.additional.map((a) => a.claim).join("\n"),
  );
  const [completionCriteria, setCompletionCriteria] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [deliveryImpact, setDeliveryImpact] = useState("");
  const [existingWorkNote, setExistingWorkNote] = useState(
    "Landing-page deliverables in the current agreement remain included.",
  );
  const [summary, setSummary] = useState("");
  const [priceText, setPriceText] = useState("");
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [clientUrl, setClientUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quoteLinesTotal = quoteLines.reduce((sum, l) => sum + l.amountCents, 0);

  const findings = useMemo(() => {
    const rows: Array<{ bucket: Bucket; item: Finding; idx: number }> = [];
    for (const bucket of ["unclear", "included", "additional"] as Bucket[]) {
      draft[bucket].forEach((item, idx) => rows.push({ bucket, item, idx }));
    }
    return rows;
  }, [draft]);

  function updateFinding(bucket: Bucket, idx: number, next: Finding) {
    const copy = structuredClone(draft);
    copy[bucket][idx] = next;
    setDraft(copy);
  }

  async function saveAnalysis() {
    const saveRes = await fetch(`/api/changes/${changeId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis: draft }),
    });
    if (!saveRes.ok) {
      const data = await saveRes.json();
      throw new Error(data.error ?? "Failed to save analysis");
    }
  }

  function copyClarification() {
    setError(null);
    startTransition(async () => {
      try {
        await saveAnalysis();
        await navigator.clipboard.writeText(clarifyQuestion);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not copy");
      }
    });
  }

  function publishIncluded() {
    setError(null);
    startTransition(async () => {
      try {
        await saveAnalysis();
        const titles =
          draft.included.map((i) => i.claim).filter(Boolean).length > 0
            ? draft.included.map((i) => i.claim)
            : ["Confirm covered by current agreement"];
        const res = await fetch(`/api/changes/${changeId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary:
              summary.trim() ||
              "This request is covered by the current agreement — no extra charge.",
            priceCents: 0,
            currency: "USD",
            optionKind: "included_ack",
            optionSummary: "Confirmed as included work",
            deliverableTitles: titles,
            existingWorkNote:
              "No change to the agreed deliverables; this is confirmation only.",
            deliveryNote: "No additional fee.",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to publish");
        setClientUrl(data.clientUrl);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to publish");
      }
    });
  }

  if (locked) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-normal">
            {OUTCOME_LABEL[draft.primaryOutcome]}
          </h2>
          <SourceBanner analysis={draft} />
        </div>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Findings
            </h3>
            {findings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No findings recorded.</p>
            ) : (
              findings.map(({ bucket, item, idx }) => (
                <FindingCard
                  key={`${bucket}-${idx}`}
                  bucket={bucket}
                  item={item}
                  locked
                  onChange={() => undefined}
                />
              ))
            )}
          </div>
          <aside className="space-y-3 rounded-[var(--radius-xl)] bg-[color:var(--brand-soft)] p-4">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Current agreement
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed tracking-body text-foreground/90">
              {agreementScope}
            </p>
          </aside>
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h3 className="text-lg font-semibold tracking-normal">Settled</h3>
          <div className="rounded-[var(--radius-xl)] border border-border bg-[color:var(--brand-soft)] px-4 py-3 text-sm text-foreground">
            <p className="font-medium">Paid records are locked</p>
            <p className="mt-1 text-muted-foreground">
              Payment was captured for this request, so editing and publishing
              are disabled. Add a new client request on the project for further
              changes.
            </p>
          </div>
        </section>
      </div>
    );
  }

  function publishAdditional() {
    setError(null);
    startTransition(async () => {
      try {
        const titles = addedWork
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (titles.length === 0) {
          throw new Error("Describe the added work as concrete deliverables");
        }
        if (!priceText.trim()) {
          throw new Error("Enter a price — it starts blank on purpose");
        }
        const priceCents = Math.round(Number(priceText) * 100);
        if (!Number.isFinite(priceCents) || priceCents <= 0) {
          throw new Error("Enter a valid price greater than zero");
        }
        await saveAnalysis();
        const res = await fetch(`/api/changes/${changeId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary:
              summary.trim() ||
              `Additional paid work: ${titles[0]}${titles.length > 1 ? ` (+${titles.length - 1} more)` : ""}`,
            priceCents,
            currency: "USD",
            optionKind: "extra_price",
            optionSummary: "Additional paid work",
            deliverableTitles: titles,
            completionCriteria: completionCriteria.trim() || undefined,
            exclusions: exclusions.trim() || undefined,
            deliveryImpact: deliveryImpact.trim() || undefined,
            existingWorkNote: existingWorkNote.trim() || undefined,
            deliveryNote: deliveryImpact.trim() || undefined,
            quoteLines,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to publish");
        setClientUrl(data.clientUrl);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to publish");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-normal">
            {OUTCOME_LABEL[draft.primaryOutcome]}
          </h2>
        </div>
        <SourceBanner analysis={draft} />
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Findings
          </h3>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No findings yet — classify manually before acting.
            </p>
          ) : (
            findings.map(({ bucket, item, idx }) => (
              <FindingCard
                key={`${bucket}-${idx}`}
                bucket={bucket}
                item={item}
                onChange={(next) => updateFinding(bucket, idx, next)}
              />
            ))
          )}
        </div>

        <aside className="space-y-3 rounded-[var(--radius-xl)] bg-[color:var(--brand-soft)] p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Current agreement
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed tracking-body text-foreground/90">
            {agreementScope}
          </p>
        </aside>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h3 className="text-lg font-semibold tracking-normal">Your next step</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "clarify" ? "brand" : "outline"}
            onClick={() => setMode("clarify")}
          >
            Ask first
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "included" ? "brand" : "outline"}
            onClick={() => setMode("included")}
          >
            Confirm included
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "propose" ? "brand" : "outline"}
            onClick={() => setMode("propose")}
          >
            Prepare paid proposal
          </Button>
        </div>

        {mode === "clarify" ? (
          <div className="space-y-3">
            <Label htmlFor="clarify">Clarification question</Label>
            <Textarea
              id="clarify"
              rows={3}
              value={clarifyQuestion}
              onChange={(e) => setClarifyQuestion(e.target.value)}
            />
            <Button
              type="button"
              onClick={copyClarification}
              disabled={pending || !clarifyQuestion.trim()}
            >
              {copied ? "Copied" : pending ? "Saving…" : "Copy clarification question"}
            </Button>
          </div>
        ) : null}

        {mode === "included" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Publishes a $0 confirmation the client can accept — no PayPal
              checkout.
            </p>
            <div className="space-y-2">
              <Label htmlFor="inc-summary">Summary (optional)</Label>
              <Textarea
                id="inc-summary"
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="This request is covered by the current agreement."
              />
            </div>
            <Button type="button" variant="brand" onClick={publishIncluded} disabled={pending}>
              {pending ? "Publishing…" : "Publish included confirmation"}
            </Button>
          </div>
        ) : null}

        {mode === "propose" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Price starts blank. AI never fills it. Only publish once the work
              is concrete enough to agree to.
            </p>
            <div className="space-y-2">
              <Label htmlFor="added">Added work</Label>
              <Textarea
                id="added"
                rows={3}
                value={addedWork}
                onChange={(e) => setAddedWork(e.target.value)}
                placeholder={"Blog listing page\nArticle template"}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="criteria">Completion criteria</Label>
                <Textarea
                  id="criteria"
                  rows={3}
                  value={completionCriteria}
                  onChange={(e) => setCompletionCriteria(e.target.value)}
                  placeholder="Responsive layouts; article content supplied by client"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclusions">Exclusions</Label>
                <Textarea
                  id="exclusions"
                  rows={3}
                  value={exclusions}
                  onChange={(e) => setExclusions(e.target.value)}
                  placeholder="Copywriting and ongoing article publishing"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="impact">Delivery impact</Label>
                <Input
                  id="impact"
                  value={deliveryImpact}
                  onChange={(e) => setDeliveryImpact(e.target.value)}
                  placeholder="Three additional working days"
                />
              </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="—"
              />
              {quoteLinesTotal > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Quote lines total {formatUsd(quoteLinesTotal)} (estimates
                  included). Enter the final price you want the client to pay —
                  nothing is auto-filled.
                </p>
              ) : null}
            </div>
          </div>
          <ProductsMaterialsPicker lines={quoteLines} onChange={setQuoteLines} />
          <div className="space-y-2">
            <Label htmlFor="existing">Existing work</Label>
              <Textarea
                id="existing"
                rows={2}
                value={existingWorkNote}
                onChange={(e) => setExistingWorkNote(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sum">Proposal headline</Label>
              <Input
                id="sum"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Add blog listing and article template"
              />
            </div>
            <Button type="button" variant="brand" onClick={publishAdditional} disabled={pending}>
              {pending ? "Publishing…" : "Publish and get client link"}
            </Button>
          </div>
        ) : null}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {clientUrl ? (
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--brand)]/15 bg-[color:var(--brand-soft)] p-4 text-sm text-[color:var(--brand)]">
          <p className="font-semibold text-foreground">Proposal ready — send this link</p>
          <p className="mt-2 break-all">{clientUrl}</p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => navigator.clipboard.writeText(clientUrl)}
          >
            Copy client link
          </Button>
        </div>
      ) : null}
    </div>
  );
}
