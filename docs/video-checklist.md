# Demo recording checklist

Suggested length: **3–5 minutes**.

## Suggested shots

1. Landing → Log in as Freelancer A (`AUTH_MODE=demo` or Supabase)
2. Contrast (`AI_PROVIDER=ollama` or `hosted`): same client message on Landing vs Full marketing site projects
3. Paste request + call notes → review → confirm included or set price → publish
4. Client tab: accept → PayPal sandbox pay → Payment received
5. Freelancer: agreement items; checklist; paid lock
6. Log out → Freelancer B → cannot open A’s project
7. Optional: client clarification thread vs manual notes; or `AI_PROVIDER=manual` review path

## Narration themes

- Start from the conversation already on record — not a separate intake form.
- AI suggests classification; the freelancer sets the price. Notes are not client acceptance.
- Acceptance is not payment.
- Paid records lock to the agreed proposal.
- Two demo accounts are isolated by ownership.

## Recording setup

- PayPal sandbox buyer (US) off-repo
- Optional: tunnel + `PAYPAL_WEBHOOK_ID` for webhook demo
- Public `NEXT_PUBLIC_APP_URL` if recording against a deployed instance
