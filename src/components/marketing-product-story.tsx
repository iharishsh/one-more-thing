"use client";

import { CheckIcon, CircleHelpIcon, QuoteIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ExampleId = "included" | "clarify" | "additional";

type Example = {
  id: ExampleId;
  tab: string;
  clientMessage: string;
  agreementQuote: string;
  aiLabel: string;
  aiDetail: string;
  evidence: string;
  decision: string;
  outcome: string;
  outcomeTone: "included" | "clarify" | "paid";
};

const EXAMPLES: Example[] = [
  {
    id: "included",
    tab: "Covered",
    clientMessage: "Can we adjust the hero colours?",
    agreementQuote:
      "Up to two rounds of visual polish on approved layouts, including colour and type tweaks.",
    aiLabel: "Covered revision",
    aiDetail: "Matches the polish rounds already in the agreement — no new deliverable.",
    evidence: "“two rounds of visual polish… colour and type tweaks”",
    decision: "Mark as covered · No extra charge",
    outcome: "Covered by agreement · No extra charge",
    outcomeTone: "included",
  },
  {
    id: "clarify",
    tab: "Needs clarification",
    clientMessage: "Can you make it pop?",
    agreementQuote:
      "Marketing site redesign for launch — homepage, about, and contact.",
    aiLabel: "Needs clarification",
    aiDetail:
      "“Pop” is not a scoped change. Ask what should change before quoting.",
    evidence: "No matching quote for motion, illustration, or new sections.",
    decision: "Send clarification first",
    outcome: "Ask first · “Which section should feel louder, and how?”",
    outcomeTone: "clarify",
  },
  {
    id: "additional",
    tab: "New paid work",
    clientMessage: "Could you add a blog too?",
    agreementQuote:
      "Marketing site redesign for launch — homepage, about, and contact. Blog and CMS are out of scope.",
    aiLabel: "New paid work",
    aiDetail: "Blog page + article template are outside the signed pages.",
    evidence: "“Blog and CMS are out of scope.”",
    decision: "Price set by freelancer · $150",
    outcome: "Proposal accepted · $150 sandbox payment received",
    outcomeTone: "paid",
  },
];

/**
 * Fixed marketing preview for the home blue band — not wired to app data.
 */
export function MarketingProductStory({
  exiting = false,
}: {
  exiting?: boolean;
}) {
  const [activeId, setActiveId] = useState<ExampleId>("additional");
  const example = EXAMPLES.find((item) => item.id === activeId) ?? EXAMPLES[2];

  return (
    <div
      className={cn(
        "marketing-product-story flex flex-col px-3.5 pb-6 pt-5 md:px-7 md:pb-8 md:pt-6",
        exiting && "is-exiting",
      )}
    >
      <h2 className="marketing-product-story-copy text-center font-[family-name:var(--font-plain)] text-lg font-semibold tracking-[-0.05em] text-black md:text-2xl">
        A clear answer to &ldquo;one more thing.&rdquo;
      </h2>

      <div className="marketing-product-story-card mx-auto mt-3 flex w-full max-w-[40rem] flex-col rounded-[28px] bg-white p-3.5 shadow-sm md:mt-4 md:p-5">
        <div
          className="flex gap-1 rounded-full bg-secondary p-1"
          role="tablist"
          aria-label="Example outcomes"
        >
          {EXAMPLES.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(item.id)}
                className={cn(
                  "min-h-9 flex-1 rounded-full px-2 text-xs font-semibold tracking-[-0.03em] transition-colors duration-200 md:text-sm",
                  selected
                    ? "bg-black text-white"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                {item.tab}
              </button>
            );
          })}
        </div>

        <div
          key={example.id}
          role="tabpanel"
          className="marketing-story-panel mt-3 flex flex-col gap-2.5 md:mt-4 md:gap-3"
        >
          <section className="rounded-2xl bg-secondary/80 px-3.5 py-3 md:px-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Client
            </p>
            <p className="mt-1 text-sm font-medium tracking-[-0.03em] text-foreground md:text-base">
              &ldquo;{example.clientMessage}&rdquo;
            </p>
          </section>

          <section className="rounded-2xl border border-border px-3.5 py-3 md:px-4">
            <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <QuoteIcon className="size-3.5 shrink-0" aria-hidden />
              Agreement
            </p>
            <p className="mt-1 text-sm tracking-[-0.02em] text-foreground/85">
              {example.agreementQuote}
            </p>
          </section>

          <section className="rounded-2xl border border-[color:var(--brand-bright)]/25 bg-[color:var(--accent)]/50 px-3.5 py-3 md:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[color:var(--brand)] px-2.5 py-0.5 text-[0.7rem] font-semibold text-white">
                {example.aiLabel}
              </span>
              <span className="text-[0.7rem] font-medium text-muted-foreground">
                AI suggestion
              </span>
            </div>
            <p className="mt-2 text-sm tracking-[-0.02em] text-foreground">
              {example.aiDetail}
            </p>
            <p className="mt-2 text-xs tracking-[-0.01em] text-[color:var(--brand)]">
              Evidence: {example.evidence}
            </p>
          </section>

          <section className="rounded-2xl border border-border px-3.5 py-3 md:px-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Freelancer decision
            </p>
            <p className="mt-1 text-sm font-medium tracking-[-0.03em] text-foreground">
              {example.decision}
            </p>
          </section>

          <section
            className={cn(
              "flex items-start gap-2.5 rounded-2xl px-3.5 py-3 md:px-4",
              example.outcomeTone === "paid" && "bg-[color:var(--brand)] text-white",
              example.outcomeTone === "included" &&
                "bg-secondary text-[color:var(--brand)]",
              example.outcomeTone === "clarify" &&
                "bg-[color:var(--attention)] text-black",
            )}
          >
            {example.outcomeTone === "clarify" ? (
              <CircleHelpIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <p className="text-sm font-semibold tracking-[-0.03em]">
              {example.outcome}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
