# SolveANeed — Phase 3 Implementation Backlog

Ordered. Each item lists its acceptance criteria. "Gate" items must be done before any payment code (Phase 4).

## Status after the Phase 3 delivery (23 Nov 2026)

| # | Status | Notes |
|---|---|---|
| P1 Staging | ⛔ | Needs Supabase + Vercel access |
| P2 GitHub + CI | 🟨 | Repository, `phase-3` branch and CI ✅. Branch protection must be set by the founder (SETUP_WINDOWS §9) |
| P3 Legal review | ⛔ | Counsel |
| 1 Agreement lifecycle | ✅ | Implemented as `deal_events` (covers offers and agreements) |
| 2 Offer RPCs | ✅ | `cancel_offer` is `withdraw_offer`; expiry runs in `run_jobs()` |
| 3 Offer UI (supporter) | ✅ | |
| 4 Offers Received UI | 🟨 | Done except a side-by-side diff (earlier versions are listed in full) and the 1-hour cooling-off before accepting a paid task |
| 5 Agreement view | ✅ | |
| 6 Paid-task workflow | ✅ | Start allowed only in the test environment (`sandbox_workflows`) |
| 7 Milestone workflow | 🟨 | Proposal, negotiation and frozen milestones ✅; evidence, review and auto-approval ⬜ |
| 8 Messaging | 🟨 | Done except masking (contact details are flagged and warned, not masked) |
| 9 Disputes | 🟨 | Open + independent decision ✅; dispute evidence uploads, partial outcome and appeal ⬜ |
| 10 Notifications + email | 🟨 | Durable in-app notifications ✅; email ⬜ (needs a provider) |
| 11 Background jobs | 🟨 | Offer expiry, task auto-acceptance, notification delivery ✅; rate-limit and grant purges, readiness lapse timer ⬜ |
| 12 Admin modules | 🟨 | Disputes & safety queue and case view ✅; offer/agreement search lists and verification queue ⬜ |
| 13 Requester safety UX | 🟨 | Inline warnings ✅; dedicated safety guidance page ⬜ |
| 14 E2E + integration | ✅ | |

## Pre-requisites (from the Phase 2.5 review)
| # | Item | Acceptance criteria | Owner |
|---|---|---|---|
| P1 | Staging environment | Separate Supabase project (London) + Vercel preview; migrations applied by CI; seeded **test** data only; `RATE_LIMIT_SERVER_TOKEN` and its hash configured; staff MFA on | Founder (access) + Engineering |
| P2 | Push repository to GitHub — ✅ pushed 23 Nov 2026 ([MyGreathouse/SolveANeed](https://github.com/MyGreathouse/SolveANeed)); remaining: branch protection + CI | All local commits pushed ✅; branch protection on `main`; CI runs typecheck, lint, unit, db and integration tests | Founder (repo) + Engineering |
| P3 | Legal review of the agreement engine | Written opinion on items marked [VERIFY] in AGREEMENT_ENGINE.md | Founder + counsel |

## Phase 3 — Agreements (no money movement)
| # | Item | Acceptance criteria |
|---|---|---|
| 1 | Migration: agreement lifecycle | Extended `agreement_status` + `agreement_transition_allowed()`; `agreement_events` append-only; TS mirror with parity test |
| 2 | Offer RPCs | `create_offer`, `counter_offer`, `accept_offer`, `decline_offer`, `cancel_offer`, `expire_offers` (scheduled). Enforce: opt-in for paid tasks, accepted support types, blocks, active accounts, rate limits, one open offer per supporter per need, sensitive-content screening. Adversarial DB tests for each |
| 3 | Offer UI (supporter) | "Make an offer" on need pages for the four types; form validation mirrors the RPC; axe-clean on mobile and desktop |
| 4 | Offers Received UI (requester) | List, compare versions (diff view), accept, decline, counter, block, report. 1-hour cooling-off before accepting a paid task |
| 5 | Agreement view | Immutable terms, SHA-256 shown, timeline from `agreement_events`, cancellation per policy |
| 6 | Paid-task workflow (without payment) | `payment_ready` stubbed as "Payment not yet available" — **work must not start**; submission of deliverables (private storage, scoped staff access), review, revisions, auto-accept timer |
| 7 | Milestone workflow (without payment) | Milestone proposal, moderation of criteria, evidence submission, review, auto-approval timer |
| 8 | Messaging | Threads per offer and agreement; read status; masking of contact and identity details; block and report; moderator access only via an open dispute or report (audit-logged RPC) |
| 9 | Disputes | Open, evidence, independent moderator assignment, decision with reasons, single appeal, outcomes recorded |
| 10 | Notifications + transactional email | Durable job queue (`pg_cron` or Supabase scheduled functions + an outbox table); emails for offer, acceptance, deadline, submission, review, dispute opened/resolved; respects preferences |
| 11 | Background jobs | Offer expiry, task and milestone timers, hold expiry (Phase 4), rate-limit purge, evidence grant purge |
| 12 | Admin modules | Offers, Agreements, Disputes, Verification queue |
| 13 | Requester safety UX | Safety guidance page; inline warnings for off-platform payment attempts |
| 14 | E2E + integration | Full offer → agreement → submission → acceptance → dispute journeys with real sessions; axe on all new pages |

## Phase 4 gate (payments) — not started
Provider contract and approval of each fund flow; UK hold limit confirmed; DPIA updated; HMRC platform registration; webhook endpoint with signature verification; reconciliation; refunds; payouts with approval; sandbox only until explicit go-live approval.
