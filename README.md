# SolveANeed

**Every Need Deserves a Solution.** · Post a Need. Solve a Need. · GIVE • EARN • FUND • SOLVE

SolveANeed (solveaneed.com) is a mobile-first, hybrid problem-solving marketplace for the United Kingdom. It connects people with genuine needs to individuals, businesses and organisations who can help, through four forms of support: **Give** (unconditional gifts), **Earn** (paid, agreed remote tasks), **Fund** (milestone sponsorship) and **Solve** (direct practical help).

> **Status: Phase 1 (Foundation) and core Phase 2 (Marketplace).** Payments are **not** implemented and are blocked at database level. See [`docs/HANDOFF_PHASE_1.md`](docs/HANDOFF_PHASE_1.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres, Storage) · Zod · Vitest · Playwright · axe-core. Deploys to Vercel.

## Quick start

```bash
npm install
cp .env.example .env.local      # add your Supabase URL + publishable key
npx supabase link --project-ref <your-project-ref>
npx supabase db push            # applies supabase/migrations
npm run dev                     # http://localhost:3000
```

Windows step-by-step: [`docs/SETUP_WINDOWS.md`](docs/SETUP_WINDOWS.md).

Without Supabase keys the site still runs in **preview mode**: public pages render and forms explain that accounts aren't available yet.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run typecheck` / `lint` | Type and lint checks |
| `npm test` | Unit tests (money, state machines, matching, validation) |
| `npm run test:db` | Row-level security and trigger tests. Needs `TEST_DATABASE_URL`, a **disposable** database that is dropped on each run |
| `npm run test:e2e` | Browser end-to-end and accessibility tests against a non-production stack |

## Project layout

```
app/                 Routes (public site, auth, dashboard, admin, API)
components/          UI: brand, ui primitives, layout, home, needs, dashboard
lib/money            Integer minor-unit, multi-currency money library
lib/domain           State machines, validation schemas, matching rules
lib/auth             Data-access layer: session, role and staff guards
lib/data             Server-only database queries
lib/payments         Payment provider interface (Phase 4, not implemented)
supabase/migrations  Versioned SQL schema, RLS policies, RPCs
supabase/templates   Branded auth email templates
tests/{unit,db,e2e}  Test suites
docs/                Architecture, security, compliance, testing, handoff
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Security](docs/SECURITY.md)
- [UK compliance register](docs/COMPLIANCE_REGISTER.md)
- [Image placement plan](docs/IMAGE_PLAN.md)
- [Testing](docs/TESTING.md)
- [Setup on Windows](docs/SETUP_WINDOWS.md)
- [Phase 1 handoff report](docs/HANDOFF_PHASE_1.md)

© SolveANeed. Brand rule: always **SolveANeed** (capital S, A, N).
