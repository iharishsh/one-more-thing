# Agentic workspace & payment follow-up

AI does the busywork. The freelancer only **reviews, approves and gets paid**.

| Step | Who | What happens |
|---|---|---|
| Client sends a request | Client | Through the project's **client request link** (`/request/<token>`), no email or chat to copy over. |
| Triage | AI | The request is analyzed against the agreement as soon as it arrives (covered / new paid work / needs info), and preparation starts automatically. It shows up in **Your next actions**. |
| Decide & price | Freelancer | Confirm it's covered, or set the price. AI never sets prices. |
| Accept | Client | Accepts on the proposal page, optionally leaving an email. |
| Payment follow-up | AI → Freelancer | If checkout isn't paid within `BILLING_FOLLOWUP_AFTER_MINUTES`, AI drafts a PayPal invoice for the exact accepted amount. One click approves it, then AI queues "email invoice", then reminders 72 hours apart (at most 3). |
| Paid | PayPal → App | A paid invoice is recorded like a checkout capture: payment saved, agreement and checklist updated. |
| Pay the team | AI → Freelancer | When a client pays, a payout is drafted for each subcontractor's agreed share (PayPal Payouts). One click sends it. |
| Stay current | App | Each project gets a refreshed "Where things stand" line, and the workspace shows a digest (to review · to approve · waiting on clients · unpaid · paid this month). |

## How it's built

- **PayPal Agent Toolkit** (`@paypal/agent-toolkit/openai`) supplies the invoicing tools (`create_invoice`, `send_invoice`, `send_invoice_reminder`, `get_invoice`) to the hosted model as function tools. See `src/server/paypal/agent-toolkit.ts`.
- **Planner**: the model sees the accepted terms and live invoice status, may call `get_invoice`, and ends on one proposed write. It's stored as a `BillingAgentAction` (`PROPOSED`). Nothing reaches PayPal until the freelancer approves. See `src/features/billing/billing-agent.service.ts`.
- **Guardrails** (`billing-guardrails.ts`): invoice items must total the accepted price exactly; the only recipient is the client's email; tip, shipping, partial payment, tax and discount are stripped or rejected; any invoicer identity the model invents is stripped; only the four invoicing tools are allowed. Every call is checked again against live PayPal state right before it runs. If the model is unavailable, a fixed rules planner drafts the same step.
- **Background sweep** (`runBillingSweep`, every 60s in the in-process worker): records paid invoices the webhook missed, and drafts the next due step for approval. It never runs a PayPal write by itself.
- **Invoice paid**: `INVOICING.INVOICE.PAID` webhook → `applyPaidInvoiceById`. The invoice is re-read from PayPal, matched to the proposal amount, and saved once (unique `Payment.paypalInvoiceId`). If the client also paid at checkout, the app logs a "refund one" warning instead of applying twice.
- **Project status line** (`project-summary.ts`): rebuilt after every recorded activity from the AI-classified requests and payment records. It's deterministic on purpose: a model rewrite was tested and misstated request states, so it was dropped.
- **Client request link** (`src/features/intake`): public form, IP rate-limited, capped at 10 requests per project per hour.

## Setup

PayPal Developer Dashboard → your app → **Webhooks**, subscribe the webhook URL to:

- `Payment capture completed` (checkout)
- `Invoicing invoice paid` (payment follow-up invoices)

`.env`: `BILLING_FOLLOWUP_AFTER_MINUTES="0"` for demos (default 10).

## Judge demo account

`pnpm demo:reset` copies a curated workspace (`DEMO_TEMPLATE_EMAIL`) into a shared demo login (`DEMO_ACCOUNT_EMAIL`), generating `DEMO_ACCOUNT_PASSWORD` into `.env` on first run. Login has **Explore the demo workspace**: the server signs in with those credentials, so the password never reaches the browser. If a visitor changes the shared account's email or password, the next demo sign-in restores them. Rerun the reset any time to restore the sample data (Render uses the same database).

## AI safety & limits

- Client text (requests, notes) is wrapped as untrusted data in prompts; the model can only propose, and guardrails enforce price, recipient and allowed tools.
- The client's email never goes to the model. It sees a placeholder, and the server fills in the real address.
- Rate limits: 40 AI requests/min per IP, at most 2 concurrent hosted calls, 10 client-link requests per project per hour.
- Failure modes: the hosted chain fails over (groq → openrouter → openai). Analysis falls back to "needs review", and payment follow-up falls back to the rules planner. The app never errors because the AI is busy.

## Subcontractor payouts (PayPal Payouts)

- Add subcontractors on a project: name, PayPal email, and a share of each paid change (1–90%, at most 90% in total).
- When a change is paid (checkout or invoice), the app drafts one payout per subcontractor. The amount is `floor(price × share)`, never chosen by AI. Drafts appear under **Your next actions** and on the change page.
- On approval, the draft is re-checked against current records (recipient, share, paid status). It's sent once, with a `sender_batch_id` of `omt-<proposal>-<subcontractor>`, which PayPal itself refuses to reuse. Live batch status is shown on the change page.
- Only changes paid **after** a subcontractor was added get payouts. Removing a subcontractor cancels their pending drafts. Failed payouts can be re-drafted with **Try again**.
- **The merchant account must be in a Payouts-enabled country** (e.g. US). India-registered PayPal accounts can't send Payouts, and PayPal returns "You live in a country that is not allowed to send this payout".
