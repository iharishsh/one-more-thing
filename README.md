# One More Thing

PayPal + AI hackathon project: turn vague client “one more thing” requests into reviewed proposals, acceptance, and sandbox checkout.

**Rule:** AI proposes; the app owns agreements, prices, payments, and delivery updates.

**Release candidate** — architecture frozen; remaining work is demo video + judge hosting URL.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Zod, Prisma 7, PostgreSQL
- Auth: explicit `AUTH_MODE=demo` **or** Supabase (`AUTH_MODE=supabase`)
- PayPal Orders API + verified webhooks
- AI providers: `manual` (needs-review only) | `ollama` | `hosted`
- Channel3 product search, AG Grid activity/ops
- Vitest + Playwright

## Setup

```bash
pnpm install
cp .env.example .env
# fill PayPal (+ optional Channel3 / Ollama / Supabase)
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

### Demo auth (`AUTH_MODE=demo`)

Pick **Freelancer A** or **B** on `/login`. There is no silent seeded session.

### Supabase auth (`AUTH_MODE=supabase`)

Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key). Missing keys fail closed — they do **not** fall back to demo.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm db:migrate` | Prisma migrate |
| `pnpm db:seed` | Seed A/B freelancers + contrast projects |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | Playwright |
| `pnpm build` | Production build |

Live AI contrast tests: `RUN_AI_CONTRAST=1 AI_PROVIDER=ollama pnpm test tests/ai-contrast.test.ts`

## Docs for judges

- [Judges quickstart](docs/judges-quickstart.md)
- [Demo script](docs/demo-script.md)
- [Video checklist](docs/video-checklist.md)
- [Architecture](docs/architecture.md)
- [Sponsor tools](docs/sponsor-tools.md)
- [Product](docs/product.md)

## Deploy on Render (Web Service)

Free instances cannot install packages globally (`corepack enable` / `npm i -g` → `EROFS`).  
Pre-Deploy commands are **paid-only** — run migrations in the build instead.

Paste these **exactly** into Render → Settings:

| Field | Value |
|---|---|
| **Build Command** | `npx --yes pnpm@10.15.1 install --frozen-lockfile && npx --yes pnpm@10.15.1 exec prisma generate && npx --yes pnpm@10.15.1 exec prisma migrate deploy && npx --yes pnpm@10.15.1 run build` |
| **Pre-Deploy Command** | *(leave empty on free tier)* |
| **Start Command** | `npm run start` |

Same build as a script: `bash scripts/render-build.sh`

Use Supabase for Auth + `DATABASE_URL` (session pooler `:5432`). Set `AI_PROVIDER=hosted` or `manual`, plus PayPal sandbox env vars. `NEXT_PUBLIC_APP_URL` = your `https://….onrender.com` URL.

## Submission leftovers (outside the repo)

- Recorded demo **video** — follow [video-checklist.md](docs/video-checklist.md)
- Deployed judge URL (optional if judges run locally from this repo)
