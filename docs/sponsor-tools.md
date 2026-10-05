# Integrations

Third-party services used in this project.

## APIMatic — PayPal Context Plugin

See [paypal-context-plugin.md](./paypal-context-plugin.md) for install steps and how it relates to the PayPal Server SDK.

## AG Grid Community — Operations view

Community edition (production-friendly).

Page: `/workspace/operations`

Table of change requests: scope finding, agreement, amount, payment status, next action. Row click opens the review screen.

## Channel3 — Products and materials (optional)

Sign up at [trychannel3.com/developers](https://trychannel3.com/developers). Promo code `PAYPAL-HACKATHON-2026` may apply for trial search credits (check Channel3 for current terms).

```env
CHANNEL3_API_KEY=your_key_here
```

Attach sourced products to a paid proposal (any trade). PayPal checkout does not place retailer orders.

- Search: `POST /api/products/search`
- UI: “Products & materials” on the paid-proposal editor

## Not integrated

- **Bryntum:** scheduling timelines (trial product; not wired in).
- **Render:** example host only; see README deploy section.
