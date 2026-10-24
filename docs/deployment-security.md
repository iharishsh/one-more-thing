# Deployment security

Use this checklist when exposing a public instance (demo or production).

## CSRF on browser mutations

- `POST`, `PATCH`, and `DELETE` under `/api/*` require a valid **Origin** or **Referer** matching the app URL or localhost.
- Set `NEXT_PUBLIC_APP_URL` to the deployed origin (e.g. `https://app.example.com`).
- Additional origins: `CSRF_ALLOWED_ORIGINS=https://preview.example.com` (comma-separated).
- Exception: `/api/paypal/webhook` (signature verification only).

Tests: `pnpm test tests/security-csrf-rate-limit.test.ts`

## Rate limiting

Middleware applies per-IP limits (in-memory; suitable for a single app instance):

| Bucket | Examples | Limit |
|---|---|---|
| `auth` | `/api/auth/demo-login` | 20 / minute |
| `ai` | prepare, reanalyze, agent, analyze, refine, product search | 40 / minute |
| `api` | other mutations | 120 / minute |

Responses: `403` (CSRF), `429` with `Retry-After`.

## AI provider capacity

- Configure failover: `HOSTED_AI_CHAIN=groq,openrouter` (or multiple configured endpoints).
- Default `HOSTED_AI_MAX_CONCURRENT=2` limits parallel outbound hosted calls to reduce provider `429` responses.
- When analysis fails, the review UI shows an amber banner (`source: fallback`) and manual classification — not a silent AI success.

## Supabase RLS

Advisor “RLS Disabled in Public” is expected until this migration is applied:

```bash
pnpm db:migrate
# deployed: included in Render build `prisma migrate deploy`
```

That enables RLS on every `public` table and revokes `anon` / `authenticated`. No policies are added: PostgREST stays closed; Prisma still connects as `postgres` (bypasses RLS). After apply, Advisor may show “RLS enabled, no policy” — that is the intended deny-all.

## PayPal

- Webhooks: verify signatures; CSRF not applied.
- Sandbox: US personal buyer for USD checkout (see demo walkthrough).
