"use client";

import { isAgentRunActive, useAgentPoll } from "@/lib/agent-poll";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  classificationCount,
  isClassificationFinding,
  missingInfoCount,
} from "@/features/changes/analysis-display";
import { RecordAgreementDialog } from "@/features/projects/components/record-agreement-dialog";
import {
  derivePrimaryOutcome,
  ensureFindingIds,
  moveFindingBucket,
  type AnalysisResult,
  type Finding,
  type FindingBucket,
} from "@/features/changes/analysis.schema";
import type { QuoteLine } from "@/features/products/product.schema";
import { ProductsMaterialsPicker } from "@/features/products/components/products-materials-picker";
import {
  PublishedProposalPanel,
  type LiveProposal,
} from "@/features/changes/components/published-proposal-panel";
import { BusyHint, BusyOverlay } from "@/components/busy-state";
import { Spinner } from "@/components/spinner";
import { StatusBadge } from "@/components/status-badge";
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
import { Textarea } from "@/components/ui/textarea";

const BUCKET_LABEL: Record<FindingBucket, string> = {
  included: "Already covered",
  additional: "New paid work",
  unclear: "Not sure yet",
};

function bucketLabel(bucket: FindingBucket, item: Finding) {
  if (bucket === "unclear" && isClassificationFinding(item)) {
    return "Choose…";
  }
  return BUCKET_LABEL[bucket];
}

const BUCKET_OPTIONS: FindingBucket[] = ["included", "additional", "unclear"];

const DELIVERY_ANCHOR_OPTIONS = [
  { value: "unset", label: "Leave unset" },
  { value: "acceptance", label: "Client acceptance" },
  { value: "payment", label: "Payment" },
  { value: "agreed_start", label: "An agreed start date" },
  { value: "custom", label: "As written above only" },
] as const;

type HistoryMessage = {
  id: string;
  kind: string;
  visibility: string;
  body: string;
  createdAt: string;
};

type AgentState = {
  thread: {
    inviteUrl: string;
    revokedAt: string | null;
    messages: HistoryMessage[];
  } | null;
  run: {
    id: string;
    status: string;
    draftStale: boolean;
    needsReviewReason: string | null;
    pendingClarification: {
      question: string;
      relatedClaims: string[];
      relatedItemIds?: string[];
    } | null;
    analysis: AnalysisResult | null;
  } | null;
};

function SourceBanner({
  analysis,
  aiCanRetry,
  aiConfigIssue,
  onRetryAi,
  pending,
}: {
  analysis: AnalysisResult;
  aiCanRetry: boolean;
  aiConfigIssue: string | null;
  onRetryAi: () => void;
  pending: boolean;
}) {
  if (analysis.source === "fallback" || analysis.source === "manual" || aiConfigIssue) {
    return (
      <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">
          {aiConfigIssue
            ? "Suggestions aren’t set up — decide manually"
            : analysis.source === "fallback"
              ? "Couldn’t auto-sort this — decide manually"
              : "Decide manually"}
        </p>
        <p className="text-amber-900/80">
          {aiConfigIssue ??
            analysis.sourceDetail ??
            "Use the menu on each item to say if it’s already covered or new work."}{" "}
          Needing a decision here is not the same as missing client info.
        </p>
        {aiCanRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onRetryAi}
          >
            {pending ? "Retrying…" : "Retry AI"}
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Here’s a suggested reading against what’s agreed. Fix anything that
      doesn’t match what you discussed.
    </p>
  );
}

function suggestedTitle(analysis: AnalysisResult) {
  const first =
    analysis.additional[0]?.claim ||
    analysis.included[0]?.claim ||
    "New work";
  return first.length > 80 ? `${first.slice(0, 80)}…` : first;
}

export function ReviewDecisionEditor({
  changeId,
  projectId,
  analysis,
  agreementScope,
  agreementUnconfirmed = false,
  openingRequest = null,
  agreementSource = null,
  clientMessage,
  discussionNotes,
  discussedPriceCents,
  discussedDeliveryNote,
  locked = false,
  liveProposal = null,
  appUrl = "http://localhost:3000",
  canRevoke = false,
  aiCanRetry = false,
  aiConfigIssue = null,
}: {
  changeId: string;
  projectId: string;
  analysis: AnalysisResult;
  agreementScope: string;
  agreementUnconfirmed?: boolean;
  openingRequest?: string | null;
  agreementSource?: string | null;
  clientMessage: string;
  discussionNotes?: string | null;
  discussedPriceCents?: number | null;
  discussedDeliveryNote?: string | null;
  locked?: boolean;
  liveProposal?: LiveProposal | null;
  appUrl?: string;
  canRevoke?: boolean;
  aiCanRetry?: boolean;
  aiConfigIssue?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => ensureFindingIds(analysis));
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [revising, setRevising] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(discussionNotes?.trim()));
  const [showEvidence, setShowEvidence] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [contextNotes, setContextNotes] = useState("");
  const [editor, setEditor] = useState<
    null | { mode: "notes" | "ask"; itemId: string | null }
  >(null);
  const [askQuestion, setAskQuestion] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [markedIncluded, setMarkedIncluded] = useState(
    Boolean(analysis.freelancerDecision?.kind === "included"),
  );
  const [decision, setDecision] = useState<"included" | "propose" | null>(() => {
    if (agreementUnconfirmed) return null;
    if (analysis.unclear.length > 0) return null;
    if (analysis.additional.length > 0) return "propose";
    if (analysis.included.length > 0) return "included";
    return null;
  });
  const [summary, setSummary] = useState(() =>
    agreementUnconfirmed
      ? clientMessage.replace(/\s+/g, " ").trim().slice(0, 80)
      : suggestedTitle(analysis),
  );
  const [priceText, setPriceText] = useState(
    discussedPriceCents != null ? (discussedPriceCents / 100).toFixed(2) : "",
  );
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [addedWork, setAddedWork] = useState(() => {
    const fromAdditional = analysis.additional.map((a) => a.claim).join("\n");
    if (fromAdditional.trim()) return fromAdditional;
    if (agreementUnconfirmed) return clientMessage.trim();
    return "";
  });
  const [completionCriteria, setCompletionCriteria] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [deliveryTiming, setDeliveryTiming] = useState(
    discussedDeliveryNote?.trim() || "",
  );
  const [deliveryAnchor, setDeliveryAnchor] = useState<
    "unset" | "acceptance" | "payment" | "agreed_start" | "custom"
  >(discussedDeliveryNote?.trim() ? "custom" : "unset");
  const [clientUrl, setClientUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function composedDelivery() {
    const timing = deliveryTiming.trim();
    if (deliveryAnchor === "unset") return timing || undefined;
    if (deliveryAnchor === "acceptance") {
      return timing
        ? `${timing} from client acceptance`
        : "From client acceptance";
    }
    if (deliveryAnchor === "payment") {
      return timing ? `${timing} from payment` : "From payment";
    }
    if (deliveryAnchor === "agreed_start") {
      return timing
        ? `${timing} from agreed start date`
        : "From an agreed start date";
    }
    return timing || undefined;
  }

  const findings = useMemo(() => {
    const rows: Array<{ bucket: FindingBucket; item: Finding }> = [];
    for (const bucket of ["unclear", "included", "additional"] as FindingBucket[]) {
      draft[bucket].forEach((item) => rows.push({ bucket, item }));
    }
    return rows;
  }, [draft]);

  const unresolved = draft.unclear.length;
  const classN = classificationCount(draft);
  const missingN = missingInfoCount(draft);
  const provisional = agreementUnconfirmed;
  const readyIncluded =
    !provisional && draft.included.length > 0 && unresolved === 0;
  const readyAdditional =
    provisional || (draft.additional.length > 0 && unresolved === 0);
  const decidedIncluded =
    markedIncluded || draft.freelancerDecision?.kind === "included";

  function startFirstProposal() {
    setDecision("propose");
    if (!addedWork.trim()) setAddedWork(clientMessage.trim());
    if (!summary.trim()) {
      setSummary(clientMessage.replace(/\s+/g, " ").trim().slice(0, 80));
    }
  }

  useEffect(() => {
    if (!agreementUnconfirmed) return;
    const setup = new URLSearchParams(window.location.search).get("setup");
    if (setup === "first-proposal") startFirstProposal();
    // Intentionally once on mount for deep-link from project setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreementUnconfirmed]);

  async function refreshAgent() {
    const res = await fetch(`/api/changes/${changeId}/agent`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return false;
    setAgent(data);
    if (data.run?.pendingClarification?.question) {
      setAskQuestion(data.run.pendingClarification.question);
    }
    if (data.thread?.inviteUrl) setInviteUrl(data.thread.inviteUrl);
    return isAgentRunActive(data.run?.status);
  }

  useAgentPoll(refreshAgent, [changeId]);

  useEffect(() => {
    // Prefer live analysis from page refresh; don't clobber local edits mid-type.
    setDraft(ensureFindingIds(analysis));
    setMarkedIncluded(analysis.freelancerDecision?.kind === "included");
    if (analysis.freelancerDecision?.kind === "included") {
      setDecision("included");
    } else if (analysis.unclear.length === 0) {
      setDecision(
        analysis.additional.length > 0
          ? "propose"
          : analysis.included.length > 0
            ? "included"
            : null,
      );
    }
  }, [analysis]);

  async function saveAnalysis(next: AnalysisResult = draft) {
    const normalized = ensureFindingIds({
      ...next,
      primaryOutcome: derivePrimaryOutcome(next),
    });
    const saveRes = await fetch(`/api/changes/${changeId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis: normalized }),
    });
    if (!saveRes.ok) {
      const data = await saveRes.json();
      throw new Error(data.error ?? "Failed to save analysis");
    }
    setDraft(normalized);
  }

  function setBucket(itemId: string, bucket: FindingBucket) {
    const next = moveFindingBucket(draft, itemId, bucket);
    setDraft(next);
    if (next.unclear.length === 0) {
      setDecision(
        next.additional.length > 0
          ? "propose"
          : next.included.length > 0
            ? "included"
            : null,
      );
    } else {
      setDecision(null);
    }
    startTransition(async () => {
      try {
        await saveAnalysis(next);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  function addContext(relatedItemId?: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/changes/${changeId}/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: contextNotes.trim(),
            relatedItemId: relatedItemId ?? undefined,
            // Only reassess when an AI provider can use the notes.
            reassess: aiCanRetry,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not save notes");
        setContextNotes("");
        setEditor(null);
        if (data.analysis) setDraft(ensureFindingIds(data.analysis));
        await refreshAgent();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save notes");
      }
    });
  }

  function openAskEditor(item: Finding) {
    setAskQuestion(
      item.clarificationQuestion ??
        "Could you clarify what you need so I can confirm whether this is included or new work?",
    );
    setEditor({ mode: "ask", itemId: item.id ?? null });
    setError(null);
    startTransition(async () => {
      try {
        await saveAnalysis();
        const res = await fetch(`/api/changes/${changeId}/prepare`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not prepare question");
        await refreshAgent();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start ask");
      }
    });
  }

  function markIncluded() {
    setError(null);
    startTransition(async () => {
      try {
        await saveAnalysis();
        const res = await fetch(`/api/changes/${changeId}/mark-included`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: summary.trim() || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not mark included");
        if (data.analysis) setDraft(ensureFindingIds(data.analysis));
        setMarkedIncluded(true);
        setDecision("included");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not mark included");
      }
    });
  }

  function retryAi() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/changes/${changeId}/reanalyze`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not retry AI");
        if (data.analysis) setDraft(ensureFindingIds(data.analysis));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not retry AI");
      }
    });
  }

  function approveAsk() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/changes/${changeId}/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve_clarification",
            editedQuestion: askQuestion,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not share question");
        setEditor(null);
        await refreshAgent();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not share");
      }
    });
  }

  function copyQuestion() {
    setError(null);
    startTransition(async () => {
      try {
        const q =
          askQuestion.trim() ||
          draft.unclear[0]?.clarificationQuestion ||
          "Could you clarify what you need so I can confirm whether this is included or new work?";
        await saveAnalysis();
        await navigator.clipboard.writeText(q);
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
            // Confirmation only — do not amend agreement or burn revision rounds.
            deliverableTitles: [],
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
              (provisional
                ? `Project proposal: ${titles[0]}${titles.length > 1 ? ` (+${titles.length - 1} more)` : ""}`
                : `Additional paid work: ${titles[0]}${titles.length > 1 ? ` (+${titles.length - 1} more)` : ""}`),
            priceCents,
            currency: "USD",
            optionKind: "extra_price",
            optionSummary: provisional
              ? "First project proposal"
              : "Additional paid work",
            deliverableTitles: titles,
            completionCriteria: completionCriteria.trim() || undefined,
            exclusions: exclusions.trim() || undefined,
            deliveryImpact: composedDelivery(),
            existingWorkNote: provisional
              ? "This proposal establishes the project agreement once the client accepts."
              : "Existing agreement work is unchanged.",
            deliveryNote: composedDelivery(),
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

  const history = agent?.thread?.messages ?? [];

  if (
    liveProposal &&
    !revising &&
    !locked &&
    (liveProposal.status === "PUBLISHED" || liveProposal.status === "ACCEPTED")
  ) {
    return (
      <div className="space-y-6">
        <PublishedProposalPanel
          changeId={changeId}
          proposal={liveProposal}
          appUrl={appUrl}
          canRevoke={canRevoke}
          onCreateRevision={() => {
            setRevising(true);
            setDecision("propose");
          }}
        />
        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-muted-foreground">Request</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {clientMessage}
          </p>
          {discussionNotes?.trim() ? (
            <p className="text-xs text-muted-foreground">
              Notes (not acceptance): {discussionNotes.trim()}
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold tracking-normal">Settled</h2>
        <p className="text-sm text-muted-foreground">
          Payment was captured for this request. Records are locked — add a new
          client request for further changes.
        </p>
        <section className="space-y-3">
          {findings.map(({ bucket, item }) => (
            <article key={item.id ?? item.claim} className="border-b border-border pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{item.claim}</h3>
                <StatusBadge tone="muted">{BUCKET_LABEL[bucket]}</StatusBadge>
              </div>
            </article>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8" aria-busy={pending}>
      <BusyOverlay
        active={pending}
        title="Working…"
        detail="Saving your decision or preparing the client link."
      />

      {revising ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Editing a <span className="font-medium">revision draft</span> — the
          published link stays live until you publish new terms.
          <button
            type="button"
            className="ml-2 text-[color:var(--brand)]"
            onClick={() => setRevising(false)}
          >
            Cancel revision
          </button>
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-normal">
          What was requested
        </h2>
        <p className="whitespace-pre-wrap text-base leading-relaxed tracking-body">
          {clientMessage}
        </p>
        {discussionNotes?.trim() ? (
          <>
            <button
              type="button"
              className="text-sm font-medium text-[color:var(--brand)]"
              onClick={() => setShowNotes((v) => !v)}
            >
              {showNotes ? "Hide discussion notes" : "Discussion notes"}
            </button>
            {showNotes ? (
              <div className="border border-border px-3 py-3 text-sm">
                <p className="whitespace-pre-wrap">{discussionNotes.trim()}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your notes — not recorded client acceptance.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
        {!provisional ? (
          <SourceBanner
            analysis={draft}
            aiCanRetry={aiCanRetry}
            aiConfigIssue={aiConfigIssue}
            onRetryAi={retryAi}
            pending={pending}
          />
        ) : null}
        {agent?.run?.needsReviewReason ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {agent.run.needsReviewReason}
          </p>
        ) : null}
        {agent?.run?.status === "WAITING_CLIENT" && inviteUrl ? (
          <div className="space-y-2 rounded-[var(--radius-xl)] border border-border p-3 text-sm">
            <p className="font-medium">Waiting for client answer</p>
            <p className="break-all text-muted-foreground">{inviteUrl}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
            >
              Copy invite link
            </Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-normal">
            {provisional ? "Opening request" : "What this looks like"}
          </h2>
          {provisional ? (
            <StatusBadge tone="clarify">No agreement yet</StatusBadge>
          ) : classN > 0 && missingN === 0 ? (
            <StatusBadge tone="clarify">
              {classN} still to decide
            </StatusBadge>
          ) : missingN > 0 ? (
            <StatusBadge tone="clarify">
              {missingN} need{missingN === 1 ? "s" : ""} more info
            </StatusBadge>
          ) : revising ? (
            <StatusBadge tone="warning">Revision draft</StatusBadge>
          ) : decidedIncluded ? (
            <StatusBadge tone="included">Marked as covered</StatusBadge>
          ) : (
            <StatusBadge tone="included">Ready to decide</StatusBadge>
          )}
        </div>

        {provisional ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {(openingRequest || clientMessage).trim()}
          </p>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items yet — add notes or choose covered / new work yourself.
          </p>
        ) : (
          findings.map(({ bucket, item }) => (
            <article
              key={item.id ?? `${bucket}-${item.claim}`}
              className="space-y-3 border-b border-border pb-5 last:border-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-base font-semibold tracking-normal">
                  {item.claim}
                </h3>
                <Select
                  value={bucket}
                  onValueChange={(next) =>
                    item.id && setBucket(item.id, next as FindingBucket)
                  }
                  disabled={!item.id || pending}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label="Decide if covered or new work"
                    className="h-9 min-w-[8.5rem] rounded-full border-border bg-card px-3 text-xs font-medium"
                  >
                    <SelectValue>{bucketLabel(bucket, item)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end" position="popper">
                    {BUCKET_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {BUCKET_LABEL[opt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {bucket === "unclear" && isClassificationFinding(item) ? (
                <p className="text-sm text-muted-foreground">
                  Use the menu to say whether this is already covered or new paid
                  work. Needing a decision here is not the same as missing client
                  info.
                </p>
              ) : null}

              {showEvidence ? (
                <dl className="space-y-2 text-sm tracking-body">
                  <div>
                    <dt className="text-muted-foreground">From the message</dt>
                    <dd className="mt-0.5">“{item.quote || "—"}”</dd>
                  </div>
                  {item.agreementQuote ? (
                    <div>
                      <dt className="text-muted-foreground">From the agreement</dt>
                      <dd className="mt-0.5">“{item.agreementQuote}”</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted-foreground">Why this reading</dt>
                    <dd className="mt-0.5">{item.reason}</dd>
                  </div>
                </dl>
              ) : null}

              {bucket === "unclear" && !isClassificationFinding(item) ? (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-sm text-muted-foreground">
                    {item.clarificationQuestion ||
                      "Material detail is still missing for scope, price, or delivery."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        editor?.mode === "notes" && editor.itemId === item.id
                          ? "brand"
                          : "outline"
                      }
                      onClick={() => {
                        setEditor({ mode: "notes", itemId: item.id ?? null });
                        setContextNotes("");
                      }}
                    >
                      Add context
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        editor?.mode === "ask" && editor.itemId === item.id
                          ? "brand"
                          : "outline"
                      }
                      onClick={() => openAskEditor(item)}
                    >
                      Ask client
                    </Button>
                  </div>
                  {editor?.mode === "notes" && editor.itemId === item.id ? (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Label htmlFor={`note-${item.id}`}>
                        Your notes (not client acceptance)
                      </Label>
                      <Textarea
                        id={`note-${item.id}`}
                        rows={3}
                        value={contextNotes}
                        onChange={(e) => setContextNotes(e.target.value)}
                        placeholder="What the client already said on the call / chat…"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending || !contextNotes.trim()}
                          onClick={() => addContext(item.id)}
                        >
                          {pending ? "Saving…" : "Save context"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {editor?.mode === "ask" && editor.itemId === item.id ? (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Label htmlFor={`ask-${item.id}`}>Question for client</Label>
                      <Textarea
                        id={`ask-${item.id}`}
                        rows={3}
                        value={askQuestion}
                        onChange={(e) => setAskQuestion(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={approveAsk}
                          disabled={pending || !askQuestion.trim()}
                        >
                          Share client link
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={copyQuestion}
                          disabled={pending}
                        >
                          {copied ? "Copied" : "Copy question"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor(null)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))
        )}

        {!provisional ? (
          <>
            <button
              type="button"
              className="text-sm font-medium text-[color:var(--brand)]"
              onClick={() => setShowEvidence((v) => !v)}
            >
              {showEvidence ? "Hide message details" : "Show message details"}
            </button>
            <button
              type="button"
              className="ml-4 text-sm font-medium text-[color:var(--brand)]"
              onClick={() => setShowAgreement((v) => !v)}
            >
              {showAgreement ? "Hide what’s agreed" : "Show what’s agreed"}
            </button>
            {showAgreement ? (
              <div className="space-y-2 rounded-[var(--radius-xl)] bg-[color:var(--brand-soft)] p-4 text-sm">
                <p className="whitespace-pre-wrap">{agreementScope}</p>
                {agreementSource ? (
                  <p className="text-xs text-muted-foreground">
                    Source: {agreementSource}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="text-xl font-semibold tracking-normal">
          {provisional ? "Set up this project" : "Your decision"}
        </h2>
        {provisional ? (
          <>
            <p className="text-sm text-muted-foreground">
              Add what you already agreed with your client, or prepare a proposal
              for this new job. “Already covered” stays unavailable until there
              is an agreement to compare against.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="brand"
                onClick={() => setRecordOpen(true)}
              >
                Record existing agreement
              </Button>
              <Button
                type="button"
                size="sm"
                variant={decision === "propose" ? "brand" : "outline"}
                onClick={startFirstProposal}
              >
                Prepare first proposal
              </Button>
            </div>
            <RecordAgreementDialog
              projectId={projectId}
              openingRequest={openingRequest || clientMessage}
              open={recordOpen}
              onOpenChange={setRecordOpen}
            />
          </>
        ) : classN > 0 ? (
          <p className="text-sm text-muted-foreground">
            Choose covered or new work above before recording a decision. That’s
            your call for now — not something the client has accepted.
          </p>
        ) : missingN > 0 ? (
          <p className="text-sm text-muted-foreground">
            Add notes or ask the client about open details — or pick covered /
            new work if you already know.
          </p>
        ) : null}

        {!provisional ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={decision === "included" ? "brand" : "outline"}
              disabled={!readyIncluded && draft.included.length === 0}
              onClick={() => setDecision("included")}
            >
              Mark as covered
              {draft.additional.length > 0 ? " (covered items only)" : ""}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={decision === "propose" ? "brand" : "outline"}
              disabled={draft.additional.length === 0}
              onClick={() => setDecision("propose")}
            >
              Send a paid proposal
              {draft.included.length > 0 ? " (new work only)" : ""}
            </Button>
          </div>
        ) : null}

        {decision === "included" ? (
          <div className="space-y-3">
            {decidedIncluded ? (
              <p className="text-sm text-muted-foreground">
                Recorded as covered by the current agreement. That’s your note —
                not a new agreement and not client acceptance. Share a
                confirmation only if you want them to acknowledge it.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Saves this as covered by the current agreement (your decision).
                Optional: share a free confirmation afterward if you want the
                client to acknowledge it.
              </p>
            )}
            {!readyIncluded && unresolved > 0 ? (
              <p className="text-sm text-amber-800">
                Some items are still open. You can still mark covered items if
                you’re sure — open asks stay for later.
              </p>
            ) : null}
            <Label htmlFor="inc-summary">Summary (optional)</Label>
            <Textarea
              id="inc-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <BusyHint
              active={pending && decision === "included"}
              title={decidedIncluded ? "Publishing…" : "Saving…"}
              detail={
                decidedIncluded
                  ? "Creating the optional confirmation link."
                  : "Saving your covered decision."
              }
            />
            {!decidedIncluded ? (
              <Button
                type="button"
                variant="brand"
                onClick={markIncluded}
                disabled={pending || draft.included.length === 0}
              >
                {pending ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : (
                  "Mark as covered"
                )}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={publishIncluded}
                  disabled={pending || draft.included.length === 0}
                >
                  {pending ? (
                    <>
                      <Spinner />
                      Publishing…
                    </>
                  ) : (
                    "Share confirmation"
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {decision === "propose" ? (
          <div className="space-y-4">
            {provisional ? (
              <p className="text-sm text-muted-foreground">
                Draft the work, price, and timing. After the client accepts, that
                becomes the project agreement — not before.
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="sum">Proposal title</Label>
              <Input
                id="sum"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="added">Work included in this proposal</Label>
              <Textarea
                id="added"
                rows={3}
                value={addedWork}
                onChange={(e) => setAddedWork(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {provisional
                  ? "This becomes the agreed work once the client accepts."
                  : "Existing agreement work stays as-is unless you say otherwise under Add details."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-timing">Delivery timing</Label>
                <Input
                  id="delivery-timing"
                  value={deliveryTiming}
                  onChange={(e) => setDeliveryTiming(e.target.value)}
                  placeholder="e.g. 8 weeks"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-anchor">Timing starts from</Label>
              <Select
                value={deliveryAnchor}
                onValueChange={(next) =>
                  setDeliveryAnchor(next as typeof deliveryAnchor)
                }
              >
                <SelectTrigger
                  id="delivery-anchor"
                  className="h-11 w-full rounded-full px-4"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {DELIVERY_ANCHOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              className="block text-sm font-medium text-[color:var(--brand)]"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? "Hide details" : "Add details"}
            </button>
            {showDetails ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="criteria">Completion criteria</Label>
                  <Textarea
                    id="criteria"
                    rows={3}
                    value={completionCriteria}
                    onChange={(e) => setCompletionCriteria(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exclusions">Exclusions</Label>
                  <Textarea
                    id="exclusions"
                    rows={3}
                    value={exclusions}
                    onChange={(e) => setExclusions(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="block text-sm font-medium text-[color:var(--brand)]"
              onClick={() => setShowProducts((v) => !v)}
            >
              {showProducts
                ? "Hide products / materials"
                : "Add products or materials"}
            </button>
            {showProducts ? (
              <ProductsMaterialsPicker
                lines={quoteLines}
                onChange={setQuoteLines}
              />
            ) : null}

            {!provisional && !readyAdditional && unresolved > 0 ? (
              <p className="text-sm text-amber-800">
                Some items still need detail. This proposal covers the work
                listed above only.
              </p>
            ) : null}
            <BusyHint
              active={pending && decision === "propose"}
              title="Publishing…"
              detail="Creating the payable proposal link."
            />
            <Button
              type="button"
              variant="brand"
              onClick={publishAdditional}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Spinner />
                  Publishing…
                </>
              ) : revising ? (
                "Publish revision"
              ) : (
                "Publish and get client link"
              )}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <button
          type="button"
          className="text-sm font-medium text-[color:var(--brand)]"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? "Hide history" : "History"}
        </button>
        {showHistory ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {history.length === 0 ? (
              <li>No questions or notes yet.</li>
            ) : (
              history.map((m) => (
                <li key={m.id}>
                  • [{m.kind}] {m.body}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {clientUrl ? (
        <div className="rounded-[var(--radius-xl)] border border-[color:var(--brand)]/15 bg-[color:var(--brand-soft)] p-4 text-sm text-[color:var(--brand)]">
          <p className="font-semibold text-foreground">
            Proposal ready — send this link
          </p>
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
