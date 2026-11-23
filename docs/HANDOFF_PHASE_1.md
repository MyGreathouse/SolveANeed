# SolveANeed — Phase 1 Handoff Report

**Scope delivered:** Phase 1 (Foundation) and the core of Phase 2 (Create Need, Explore Needs, both dashboards, moderation, rules-based matching).
**Date:** 23 November 2026 · **Prepared for:** the founder and independent review by ChatGPT.

---

## 1. Features completed

| Feature | Classification |
|---|---|
| Brand system: SVG heart-and-handshake mark, live-text **SolveANeed** wordmark (gold A), light and dark variants, favicon, app icons, manifest, OG image | Implemented and tested (E2E brand-spelling check) |
| Design system: palette tokens with measured contrast, Inter + Plus Jakarta Sans, Button/Field/Alert/Badge/EmptyState/ProgressBar/PageHeader | Implemented and tested (axe WCAG 2.2 AA on 8 pages × 2 viewports) |
| Homepage with all 10 sections; database-driven listings with an honest empty state | Implemented and tested |
| How It Works, Give, Earn, For Businesses, Get Started (both onboarding journeys), draft legal pages, 404 and error pages | Implemented and tested |
| Responsive header, accessible mobile menu, footer | Implemented and tested (desktop + Pixel 7) |
| Sign-up (intent, 18+ attestation, terms) with email verification | Implemented and tested (real GoTrue + email) |
| Sign-in, sign-out, password reset by email, change password | Implemented and tested |
| Session management: sign out of other devices or everywhere; other sessions revoked after a password change | Implemented, partially tested (sign-out-others not E2E-asserted) |
| Profile editing, notification preferences, privacy information, roles on/off | Implemented, untested end to end (database rules tested) |
| Account deletion (anonymise, withdraw needs, sign out everywhere) | Implemented and tested |
| Role-based access: requester / supporter / moderator / admin; staff 404 hiding; optional staff MFA (AAL2) gate | Implemented and tested (MFA gate untested: no enrolment UI) |
| Requester dashboard: overview, My Needs (status filters), Create a Need, manage need, Documents | Implemented and tested (core flows) |
| Need lifecycle: draft → submit → review → publish / changes / reject; close; delete draft | Implemented and tested |
| Private evidence: upload (server-side type/size/signature checks), list, delete, 60-second signed viewing, audit-logged staff access | Implemented; **upload untested end to end** (no Storage API in test stack); RLS and access function database-tested |
| Explore Needs: search, category, support type, currency-scoped amount, progress, region, verification, pagination | Implemented and tested (currency and amount filters E2E) |
| Public need page: separate verification badges, save, report | Implemented and tested |
| Supporter dashboard: matched discovery with explanations, Saved Needs, Matching Preferences | Implemented; matching unit-tested; preferences page untested end to end |
| Admin console: overview stats, needs queue (+ risk-signal view), need review, reports, users (suspend/reinstate, staff roles), audit log | Implemented and tested (queue, approve, note rule, reports) |
| Notifications (in-app) | Implemented and tested |
| Multi-currency money (GBP/EUR/USD/NGN enabled; 0- and 3-decimal currencies supported) | Implemented and tested |
| Offers, negotiation, agreements, milestones, deliverables, messaging, disputes | **Schema only, no UI.** Tables, constraints and state machine done (database-tested); UI is "Coming in Phase 3/4/5" |
| Payments | **Planned / blocked.** Interface + schema only; live mode blocked in the database |
| Transactional emails beyond auth (offer accepted etc.) | Planned (Phase 3) |
| Business workspaces | Planned (Phase 5) |

## 2. Files created or modified
About 120 source files. Key locations:
- `app/`: all routes (public, `(auth)`, `(marketing)`, `dashboard/**`, `admin/**`, `api/evidence/[id]`, `auth/confirm`)
- `components/`: `brand/Logo`, `ui/*`, `layout/*`, `home/*`, `needs/*`, `dashboard/*`, `auth/*`
- `lib/`: `money`, `domain` (need/offer status, validation, matching, catalogue), `auth` (session, staff, redirects), `data`, `supabase`, `security/file-validation`, `payments/provider` (interface)
- `proxy.ts`, `next.config.ts` (security headers), `vitest.config.mts`, `playwright.config.ts`, `.env.example`
- `supabase/migrations/*.sql` (5), `supabase/templates/*.html` (3)
- `tests/unit` (2 files), `tests/db` (stub + helpers + policies), `tests/e2e` (public, marketplace, support, local-stack)
- `docs/`: this report plus Architecture, Database, Security, Compliance Register, Image Plan, Testing, Windows Setup
- `public/images/*.webp` (12 supplied images), `public/brand/*`, `public/og-image.jpg`

## 3. Database migrations
`20261123090000_foundation` · `20261123090100_needs` · `20261123090200_agreements_payments` · `20261123090300_storage` · `20261123090400_evidence_access_and_stats`. All 27 tables from the directive exist, plus `currencies`, `need_categories`, `saved_needs`, `rate_limits` and `risk_signals`. Applied cleanly to Postgres 16 with the real GoTrue `auth` schema. See `docs/DATABASE.md`.

## 4. Technical decisions
1. **Next.js 16.4 with `cacheComponents` off.** The app is session-heavy, so the classic dynamic model keeps auth reasoning simple. `proxy.ts` replaces the deprecated `middleware.ts`.
2. **No service-role key in the web app.** Everything runs as the user under RLS. Privileged steps are audited `SECURITY DEFINER` RPCs.
3. **Guard triggers use `current_user`** to tell direct client writes from RPC writes. This can't be forged through PostgREST.
4. **Multi-currency by design:** `(amount_minor bigint, currency char(3))` everywhere; per-currency limits; currencies never mixed (triggers). Rationale: the founder confirmed money is stored in multiple currencies.
5. **State machines duplicated in SQL and TypeScript,** with a test that parses the SQL so they can't drift.
6. **Explainable matching:** eligibility first, transparent points, description text never scored.
7. **18+ attestation, not date of birth** (data minimisation). Enforced in the new-user trigger.
8. **Server Actions plus Zod** for every mutation; plain GET form for filters (works without JavaScript, shareable URLs).
9. **Fonts self-hosted** via Fontsource (no third-party font requests; a simpler CSP).

## 5. Tests performed
- Type check (`tsc`), ESLint, production build (`next build`).
- 34 unit tests; 33 database policy tests on Postgres 16.
- 40 Playwright E2E tests (Chrome 153, desktop and Pixel 7 emulation) against a production build connected to **real Supabase Auth (GoTrue v2.180.0) and PostgREST v12.2.3** with a local SMTP catcher; includes axe-core WCAG 2.2 A/AA scans.
- Manual visual review of the homepage (desktop and mobile), dashboards, need form, admin review page and mobile menu.

## 6. Test results
All passing: **34/34 unit, 33/33 database, 40/40 E2E** (1 mobile-only test intentionally skipped on desktop). `npm audit`: 0 vulnerabilities.

Defects found by testing and **fixed** during the phase:
1. Teal card tagline failed colour contrast (axe).
2. Duplicate `id="confirm"` on Settings meant the account-deletion label targeted the wrong field.
3. `/account/status` was protected, so users who had just deleted their account were sent to sign-in instead of the confirmation.
4. The header's backdrop blur clipped the open mobile menu to one item. (The test now asserts the full panel is in view.)
5. Admin sidebar highlighted two items at once.
6. Signed-in mobile users had no sign-out in the menu.

## 7. Known defects and limitations
- Evidence upload hasn't run against real Supabase Storage (logic and RLS verified separately).
- No MFA enrolment screen yet, so `REQUIRE_STAFF_MFA` must stay `false` until one exists.
- Supabase types are hand-shaped (`supabase gen types` not yet wired in), so some query results are loosely typed.
- CSP still allows `'unsafe-inline'` scripts (Next.js bootstrap); a nonce-based CSP is planned.
- Rate limiting covers submissions, reports and uploads, not every action.
- Legal pages are **drafts**.
- `community.webp` has a baked-in logo and button tiles, which looks busy at card size. Consider a clean crop from the designer.
- `next build` was run locally only; no Vercel deployment has been made.

## 8. Security concerns
- Pre-launch must-dos: staff MFA, leaked-password protection, custom SMTP, nonce CSP, Supabase security advisor review, external penetration test.
- Moderators can read all private evidence (logged). Consider just-in-time access tied to an open review.
- Display names are user-chosen and not verified. "Identity verified" badges depend on a Phase 2 verification provider that isn't built.

## 9. Outstanding dependencies (founder)
1. Supabase project (London region) and keys; Vercel project; domain DNS for solveaneed.com.
2. Custom SMTP sender (e.g. no-reply@solveaneed.com).
3. Operating entity details for legal pages.
4. Legal review: Terms, Privacy Notice, Online Safety Act risk assessment, payment-flow regulatory opinion (see `COMPLIANCE_REGISTER.md`).
5. Decisions on the 3 unused images and the ® symbol in artwork (see `IMAGE_PLAN.md`).

## 10. Proposed next actions
1. Founder: connect Supabase and Vercel (`docs/SETUP_WINDOWS.md`), create the admin account, run a real moderation cycle.
2. Engineering (Phase 2 finish): MFA enrolment, then turn on `REQUIRE_STAFF_MFA`; identity verification provider evaluation; generated DB types; Storage E2E test; accessibility statement page.
3. Engineering (Phase 3): offer creation and negotiation UI on the existing schema (versioned terms, accept → immutable agreement with SHA-256), messaging with block/report, paid-task workflow, disputes and appeals, transactional email via a durable job queue.
4. Legal and compliance in parallel: items marked 🟥 in the compliance register, which block launch and Phase 4.

**No live payments exist or can be activated without explicit approval.**
