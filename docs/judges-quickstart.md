# Judges quickstart (5–10 minutes)

## Auth modes

| `AUTH_MODE` | How to enter |
|---|---|
| `demo` (default) | Open `/login`, pick **Demo Freelancer A** or **B**. No silent login. |
| `supabase` | Configure Supabase URL + publishable key, then email/password on `/login`. |

Ownership is enforced by `ownerId`. Account B must not open A’s project URLs or APIs.

## Happy path

1. `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev`
2. Log in as Freelancer A → Workspace
3. Open **Landing page redesign** (narrow agreement) **or** **Full marketing site + content** (broad)
4. Paste a client ask → Analyze → review findings → set price yourself → Publish → copy client link
5. Incognito: open link → Accept → PayPal sandbox (US personal) → confirm Paid + checklist
6. Freelancer: review page shows **Paid records are locked**

### AI modes during review

| `AI_PROVIDER` | What judges should expect |
|---|---|
| `manual` (default) | **Needs manual review** — preserves request + agreement; no automatic included/additional/price |
| `ollama` / `hosted` | Model suggestions with quotes; freelancer still sets the price |
| Missing hosted keys | Clear configuration error (does not silently use demo/manual as “AI success”) |
| Runtime AI failure | Labeled needs-review fallback (not presented as successful AI) |

## Isolation check

1. Log out → log in as Freelancer B
2. Workspace must show only **B-only consulting retainer**
3. Paste A’s project URL → access denied / not found

## PayPal sandbox notes

- Use a **US** sandbox personal buyer for USD checkout
- Webhook path: public HTTPS → `/api/paypal/webhook` with `PAYPAL_WEBHOOK_ID`
- Payment helper scripts refuse `PAYPAL_MODE=live`

## Submission status

- Code + docs in this repo: **release candidate**
- Demo video: see [video-checklist.md](./video-checklist.md) (record separately)
