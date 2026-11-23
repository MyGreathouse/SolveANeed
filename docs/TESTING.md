# SolveANeed — Testing

| Suite | Command | Needs | Count (Phase 1 run) |
|---|---|---|---|
| Unit | `npm test` | Nothing | 41 passing |
| Database policies + attacks | `npm run test:db` | `TEST_DATABASE_URL`, a **disposable** Postgres 15+ database (it is dropped on every run) | 72 passing (33 policy + 39 attack) |
| Integration (HTTP, real services) | `npx vitest run --project integration` | `INT_SUPABASE_URL`, `INT_ANON_KEY`, `INT_SERVICE_ROLE_KEY` (**test stack only**), `INT_DATABASE_URL` | 18 passing |
| End-to-end + accessibility | `npm run test:e2e` | A running app connected to a **non-production** Supabase, plus `E2E_DATABASE_URL` and either `MAILPIT_URL` or `E2E_MAIL_DIR`; `RATE_LIMIT_SERVER_TOKEN` set | 45 passing, 1 skipped by design |
| Types / lint | `npm run typecheck` / `npm run lint` | — | Clean |

## Unit tests (`tests/unit`)
Money parsing and formatting across GBP, JPY (0 decimals), KWD (3 decimals) and NGN; float-safety; fee rounding; milestone allocation; need and offer state machines (**checked against the SQL migrations** so they can't drift apart); matching filters and explanations; validation (18+, password strength, disabled currencies, control characters, invalid filters).

## Database policy tests (`tests/db`)
Builds a fresh database from `tests/db/supabase-stub.sql` (a minimal stand-in for Supabase's `auth`/`storage` schemas and default grants) plus every migration, then runs as `anon` or `authenticated` users the way PostgREST does. Covers: 18+ and terms enforcement at sign-up; protected profile fields; privilege escalation; draft privacy; direct status/funding edits blocked; submission validation, locking, duplicates and rate limits; moderation permissions, required notes and self-moderation block; members-only visibility; evidence row and storage privacy; audit-logged staff evidence access; append-only audit log; reports; account deletion; currency consistency; live-mode block; idempotency; refund ceilings; unverified webhooks; offer transitions and immutable terms.

## End-to-end tests (`tests/e2e`)
- **Public site (desktop + Pixel 7):** all homepage sections, brand spelling, both hero buttons through to sign-up, every header and footer link, explore filters, auth redirect, security headers, **axe-core WCAG 2.2 A/AA checks on 8 pages**, mobile menu (focus, Escape, panel not clipped).
- **Marketplace journey:** 18+ and password validation → sign-up with **real email verification** → incomplete submit keeps the user's input → draft saved (checks `65000` minor units in the database) → submit → hidden from the public → other user and non-staff get 404 → moderator needs a note to request changes → approval → audit trail → public listing with £ formatting and currency-scoped amount filters → save and report → notification → **password reset by email** → account deletion and anonymisation.

### Running E2E with the Supabase CLI (recommended; needs Docker Desktop)
```bash
npx supabase start            # prints API URL, anon key, DB URL, Mailpit URL
npx supabase db reset         # applies migrations
# .env.local → the printed API URL + anon key, NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run build && npm start
E2E_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres MAILPIT_URL=http://127.0.0.1:54324 npm run test:e2e
```
Point the local auth email templates at `supabase/templates/*.html` so links go to `/auth/confirm`.

Where Docker isn't available, see `tests/e2e/local-stack/README.md`. That is how the Phase 1 run was done: real GoTrue v2.180.0 and PostgREST v12.2.3 binaries against Postgres 16.

## Integration tests (`tests/integration`) — Phase 2.5
Real HTTP sessions for requester, supporter, moderator and admin (MFA completed with genuine TOTP codes): API boundary (no `set_config`, no `private` schema, internal functions unreachable); RLS by role; staff roles inert at aal1; MFA enrolment audit-logged; Storage upload, type and size rejection, cross-user and anonymous denial, signed URL expiry, staff grants and their expiry, deletion rules; session revocation (others / global); aal1 → aal2 step-up.

## Continuous integration (Phase 3)

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` and `phase-*`:

| Job | What it runs |
|---|---|
| Typecheck, lint, unit, build, audit | `npm run typecheck`, `eslint --max-warnings 0`, unit tests, brand-name check, **S1–S10 coverage guard** (`scripts/check-security-regression.mjs`), production build, `npm audit` |
| Database policy and attack tests | Rebuilds Postgres 16 from the migrations; policy, attack and Phase 3 suites; privilege audit (uploaded as an artifact) |
| Integration and end-to-end | Official images of Supabase Auth v2.180.0, PostgREST v12.2.3 and Storage API v1.11.2 (`STACK_RUNTIME=docker`), then integration tests and the full Playwright suite (desktop + Pixel 7) against a production build |

No secrets are used: `prepare.sh` generates throwaway keys per run.

Locally (Linux/macOS with Docker): `E2E_DIR=/tmp/e2e STACK_RUNTIME=docker bash tests/e2e/local-stack/prepare.sh && E2E_DIR=/tmp/e2e STACK_RUNTIME=docker bash tests/e2e/local-stack/stack.sh`.

## Phase 3 suites
- `tests/db/phase3.test.ts` — offers, negotiation, agreements, paid tasks, disputes, messaging, blocking, notifications and retries (20 tests).
- `tests/integration/phase3.test.ts` — the same over real HTTP, including `conversation-files` storage RLS (5 tests).
- `tests/e2e/deals.spec.ts` — the full journey in the browser with axe checks (11 tests). `SCREENSHOT_DIR=…` captures the screenshots in `docs/screenshots/p3-*`.

## Not yet covered
- Staging deployment (blocked: needs access).
- Visual regression, load and penetration testing.
- Manual screen-reader testing (NVDA/VoiceOver).
