# Demo video checklist

**Status: READY TO RECORD** — code is release-candidate; video is the remaining submission artifact.

Target length: **3–5 minutes**. Upload separately (Devpost / drive link).

## Suggested shots

1. Landing → Log in as Freelancer A (`AUTH_MODE=demo` or Supabase)
2. Contrast (with `AI_PROVIDER=ollama` or `hosted`): same client message on Landing vs Full marketing site
3. Analyze → edit findings if needed → optional Channel3 product → set price yourself → publish
4. Client tab: accept → PayPal sandbox pay → Payment received
5. Freelancer: agreement vN, checklist, paid lock
6. Log out → Freelancer B → cannot open A’s project
7. Optional (15s): withdraw client link or show needs-review banner with `AI_PROVIDER=manual`

## Narration beats

- “AI proposes; I set the price.”
- “Acceptance is not payment.”
- “Paid records lock — no silent scope rewrite.”
- “Two freelancers are isolated by ownership.”

## Credentials needed off-repo

- PayPal sandbox buyer (US) for recording
- Optional: tunnel URL + `PAYPAL_WEBHOOK_ID` if showing webhook path
- Devpost / hosting URL if judges use a deployed instance
