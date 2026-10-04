# Sponsor tools used in One More Thing

Prize rule reminder: one Grand Prize **or** one Honorable Mention, **plus one Sponsor Prize**. Use sponsors meaningfully in the submission.

## APIMatic — PayPal Context Plugin (installed)

**Free:** PayPal plugin needs no extra APIMatic credentials.

Installed into Cursor with:

```bash
npx context-plugins install paypal --targets cursor -y
```

Location: `~/.cursor/plugins/local/paypal`

**What we used it for (record in Devpost):**

- Confirmed Orders v2 surface on `@paypal/paypal-server-sdk` (`createOrder`, `getOrder`, `captureOrder`) instead of deprecated `paypal-rest-sdk` / Payments v1 patterns.
- Added `getPaypalOrder` and **reconcile-before-abandon** so interrupted checkouts are checked against live PayPal status before marking `FAILED`.
- Kept capture idempotent via `captureRequestId` + duplicate webhook ignore.

Reload Cursor after install so the MCP/plugin is available in future payment work.

## AG Grid Community — Changes & payments

**Free for production:** Community edition.

Page: `/workspace/operations`

Shows live rows: client request, scope finding, agreement, amount, payment, next action — filterable, opens the review screen on click.

## Channel3 — optional products & materials

**Free hackathon credits:** sign up at [trychannel3.com/developers](https://trychannel3.com/developers), use promo `PAYPAL-HACKATHON-2026` (20,000 searches).

```env
CHANNEL3_API_KEY=your_key_here
```

Generic capability: **attach sourced products to a proposed change** (any trade — frames, lamps, equipment). Not hardcoded to photography.

- Search: `POST /api/products/search`
- UI: optional “Products & materials” on paid-proposal editor
- Estimates stay labeled; PayPal payment does **not** place retailer orders

## Skipped for now

- **Bryntum:** strong for delivery timelines; 45-day trial timing vs judging — revisit if scheduling becomes core.
- **Render:** hosting credits only, not a cash sponsor target.
