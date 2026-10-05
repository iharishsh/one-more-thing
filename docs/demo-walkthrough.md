# Demo walkthrough (5–10 minutes)

Before a public demo URL, complete [deployment-security.md](./deployment-security.md) (CSRF, rate limits, AI keys).

## Auth modes

| `AUTH_MODE` | Entry |
|---|---|
| `demo` (default) | `/login` → **Demo Freelancer A** or **B** |
| `supabase` | Supabase URL + publishable key, then email/password |

Ownership is enforced by `ownerId`. Account B cannot open A’s project URLs or APIs.

## Happy path

1. `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev`
2. Log in as Freelancer A → Workspace
3. Open **Landing page redesign** (narrow agreement) or **Full marketing site + content** (broad)
4. Paste a client ask (+ optional discussion notes) → Prepare decision → classify items → Confirm included or set price → Publish → copy client link
5. Incognito: open link → Accept → PayPal sandbox (US personal) → confirm Paid + checklist
6. Freelancer: review page shows **Paid records are locked**

### AI modes during review

| `AI_PROVIDER` | Behavior |
|---|---|
| `manual` (default) | Manual review only — preserves request + agreement; no automatic included/additional/price |
| `ollama` / `hosted` | Model suggestions with quotes; freelancer sets price |
| Missing hosted keys | Configuration error (no silent fallback to “AI success”) |
| Runtime AI failure | Amber **“Couldn’t auto-sort this — decide manually”** (`source: fallback`) |
| Hosted rate limits | Use **`HOSTED_AI_CHAIN`** with multiple providers; **`HOSTED_AI_MAX_CONCURRENT=2`** |

## Isolation check

1. Log out → log in as Freelancer B
2. Workspace shows only **B-only consulting retainer**
3. Paste A’s project URL → access denied / not found

## PayPal sandbox

- US sandbox personal buyer for USD checkout
- Webhook: public HTTPS → `/api/paypal/webhook` with `PAYPAL_WEBHOOK_ID`
- Payment helper scripts refuse `PAYPAL_MODE=live`
