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

## Convincing scenario (call already happened)

Project: Landing page redesign  

**Client request:**
> Make the site feel more premium somehow before launch.

**Discussion notes (freelancer):**
> On the call they said: just update the existing brand colors on the homepage — no redesign. Agreed $0 / included polish.

Expected path:

1. Add request → paste message + discussion notes → Prepare decision
2. Review: original vague ask should narrow to homepage color update (included or as you classify)
3. Confirm included → publish $0 confirmation **or** if anything is still additional, prepare terms with price you discussed
4. Open proposal link → accept → (if paid) PayPal sandbox capture
5. Show agreement/checklist reflecting exactly that work

## Optional: still need the client

If notes are missing and the ask stays vague:

1. On the item → **Ask client** (or copy the question for WhatsApp)
2. Client answers on `/thread/{token}`
3. Understanding updates — vague ask should narrow, not stay as a second unresolved item
4. Confirm or prepare paid proposal

## Memorable close

Show: clarified change → both parties approved terms → payment arrived (if any) → agreement lists the exact items. Do not sell sandbox dollars as recovered revenue.

## Rules demonstrated

- Conversation in → decision out; clarify only when material detail is missing
- Freelancer notes ≠ acceptance
- AI/manual analysis only suggests; freelancer sets final price
- Acceptance ≠ payment
- Payable amount comes from the stored proposal, not the browser
