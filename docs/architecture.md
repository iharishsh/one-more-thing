# Architecture

## Trust boundaries

- **AI** suggests classification + evidence quotes only (`runAnalysis`).
- **App DB** owns agreements, immutable `Proposal.termsJson`, prices, payments, deliverables.
- **Client responses** live in `ClientResponse` (never mutate published terms).
- **PayPal** owns money movement; capture amount is validated against stored `Payment.expectedAmountCents` + `proposalVersion`.

## Auth

- `AUTH_MODE=demo`: httpOnly `omt_demo_user` cookie set only via `/api/auth/demo-login`.
- `AUTH_MODE=supabase`: session via `@supabase/ssr`; middleware + `requireFreelancer()`; no demo fallback.
- Freelancer APIs and `/workspace` require auth; client proposal/PayPal routes use opaque tokens.

## Payment integrity

- Orders bind `proposalId`, `proposalVersion`, `expectedAmountCents`.
- Republish supersedes prior open versions and fails open PayPal orders.
- Webhooks: PayPal `verify-webhook-signature` required; unverified → no state change.
- Webhook rows: `PROCESSED` duplicates no-op; `FAILED`/`RECEIVED` retryable; claim stamp reduces double-apply.
- Delivery appends per-proposal markers; sibling paid proposals do not overwrite each other.
