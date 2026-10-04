# Demo script

## Prep

1. `docker compose up -d`
2. `pnpm db:migrate && pnpm db:seed`
3. PayPal sandbox Client ID/Secret in `.env` (use a **US** sandbox buyer for USD)
4. `AUTH_MODE=demo` → log in at `/login` as Freelancer A (not silent)
5. AI for the contrast shot:
   - Prefer `AI_PROVIDER=ollama` or `hosted` so outcomes differ by agreement
   - `AI_PROVIDER=manual` always shows **Needs manual review** (honest offline path — not for contrast)
6. `pnpm dev`

## Agreement contrast (same message — requires live AI)

Client message: `Can you also add a blog with CMS and dark mode across all pages?`

| Project | Expect with ollama/hosted |
|---|---|
| Landing page redesign | Additional paid work (or mixed with unclear) |
| Full marketing site + content | Included / not primary-additional (already in agreement) |

With `manual`, both stay **Needs manual review** — that is intentional.

## Convincing scenario

Project: Landing page redesign  
Client message:

> Can we also add SEO pages and a blog before launch? Make it feel premium somehow.

Expected path:

1. Freelancer workspace → open project
2. Analyze request → review included/additional/unclear with quotes (or classify manually if offline)
3. Keep **extra_price**, set e.g. `$150`, publish
4. Open client link in another tab
5. Accept terms
6. Pay with US sandbox personal account
7. Confirm capture + new deliverable on project checklist / scope vN

## Rules demonstrated

- AI/manual analysis only suggests (or asks for review); freelancer sets final price
- Acceptance ≠ payment
- Payable amount comes from the stored proposal, not the browser
- Abandoned checkouts are marked failed / reused; only CAPTURED applies delivery
- Missing AI config fails closed; runtime AI failure falls back to needs-review
