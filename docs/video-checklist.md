# Demo video checklist

**Status: READY TO RECORD** — code is release-candidate; video is the remaining submission artifact.

Target length: **3–5 minutes**. Upload separately (Devpost / drive link).

## Suggested shots

1. Landing → Log in as Freelancer A (`AUTH_MODE=demo` or Supabase)
2. Contrast (with `AI_PROVIDER=ollama` or `hosted`): same client message on Landing vs Full marketing site
3. Paste request + call notes → review current understanding → confirm included or set price → publish
4. Client tab: accept → PayPal sandbox pay → Payment received
5. Freelancer: agreement lists the exact items; checklist; paid lock
6. Log out → Freelancer B → cannot open A’s project
7. Optional (15s): “Ask client” vs “Add what we discussed”; or needs-review with `AI_PROVIDER=manual`

## Narration beats

- “We start from the conversation they already had — not a clarification ceremony.”
- “AI proposes; I set the price. Notes are not acceptance.”
- “Acceptance is not payment.”
- “Paid records lock — the agreement reflects exactly that work.”
- “Two freelancers are isolated by ownership.”

## Credentials needed off-repo

- PayPal sandbox buyer (US) for recording
- Optional: tunnel URL + `PAYPAL_WEBHOOK_ID` if showing webhook path
- Devpost / hosting URL if judges use a deployed instance
