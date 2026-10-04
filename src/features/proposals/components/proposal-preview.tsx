import { formatUsd } from "@/lib/money";

type ProposalView = {
  version: number;
  summary: string;
  priceCents: number;
  currency: string;
  termsJson: unknown;
};

type Terms = {
  selectedOption?: { kind?: string; summary?: string };
  deliverableChanges?: Array<{ title: string }>;
  completionCriteria?: string | null;
  exclusions?: string | null;
  deliveryImpact?: string | null;
  existingWorkNote?: string | null;
  deliveryNote?: string | null;
  basedOnScopeVersion?: number;
  proposalRevision?: number;
  quoteLines?: Array<{
    kind: string;
    label: string;
    amountCents: number;
    estimate?: boolean;
  }>;
};

const KIND_LABEL: Record<string, string> = {
  extra_price: "Additional paid work",
  included_ack: "Covered by current agreement",
  clarify: "Clarification",
};

export function ProposalPreview({ proposal }: { proposal: ProposalView }) {
  const terms = (proposal.termsJson ?? {}) as Terms;
  const kind = terms.selectedOption?.kind ?? "";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm tracking-body text-muted-foreground">
          Proposal v{proposal.version}
          {terms.basedOnScopeVersion
            ? ` · based on scope v${terms.basedOnScopeVersion}`
            : ""}
        </p>
        <h1 className="text-heading">{proposal.summary}</h1>
        {kind ? (
          <p className="text-sm font-medium tracking-body">
            {KIND_LABEL[kind] ?? kind}
          </p>
        ) : null}
      </div>

      <p className="tracking-body">
        <span className="text-sm text-muted-foreground">Price</span>
        <br />
        <strong className="text-money text-3xl text-foreground">
          {proposal.priceCents === 0
            ? "No extra charge"
            : formatUsd(proposal.priceCents)}
        </strong>
      </p>

      {terms.deliverableChanges && terms.deliverableChanges.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold tracking-normal">
            {proposal.priceCents > 0 ? "Added work" : "Confirmation"}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm tracking-body">
            {terms.deliverableChanges.map((d) => (
              <li key={d.title}>{d.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {terms.completionCriteria ? (
        <div>
          <p className="mb-1 text-sm font-semibold tracking-normal">
            Completion criteria
          </p>
          <p className="whitespace-pre-wrap text-sm tracking-body">
            {terms.completionCriteria}
          </p>
        </div>
      ) : null}

      {terms.exclusions ? (
        <div>
          <p className="mb-1 text-sm font-semibold tracking-normal">Exclusions</p>
          <p className="whitespace-pre-wrap text-sm tracking-body">
            {terms.exclusions}
          </p>
        </div>
      ) : null}

      {terms.deliveryImpact ? (
        <div>
          <p className="mb-1 text-sm font-semibold tracking-normal">
            Delivery impact
          </p>
          <p className="text-sm tracking-body">{terms.deliveryImpact}</p>
        </div>
      ) : null}

      {terms.existingWorkNote ? (
        <div>
          <p className="mb-1 text-sm font-semibold tracking-normal">
            Existing work
          </p>
          <p className="text-sm tracking-body">{terms.existingWorkNote}</p>
        </div>
      ) : null}

      {terms.quoteLines && terms.quoteLines.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold tracking-normal">
            Quote breakdown
          </p>
          <ul className="space-y-2 text-sm tracking-body">
            {terms.quoteLines.map((line, i) => (
              <li key={`${line.label}-${i}`} className="flex justify-between gap-3">
                <span>
                  {line.label}
                  {line.estimate ? " (estimate)" : ""}
                </span>
                <span className="text-money">{formatUsd(line.amountCents)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Product estimates are not retailer orders. The freelancer purchases
            materials separately after payment if needed.
          </p>
        </div>
      ) : null}

      {terms.deliveryNote && !terms.deliveryImpact ? (
        <p className="text-sm tracking-body text-muted-foreground">
          {terms.deliveryNote}
        </p>
      ) : null}
    </div>
  );
}
