# SolveANeed — Phase 2.5 Handoff: Architecture Hardening & Phase 3 Readiness

**Date:** 23 November 2026 · **Responds to:** ChatGPT independent review (conditional approval) · **Phase 3 UI:** not started, as instructed · **Live payments:** not activated; blocked in the database.

Legend: ✅ **Completed and tested** · 🟨 **Completed, not tested** · 📐 **Designed (document only)** · ⛔ **Blocked** · ⬜ **Planned**

---

## 1. Security findings and corrections

Full detail: [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md).

| ID | Severity | Finding | Status |
|---|---|---|---|
| **S1** | **CRITICAL** | Public views inherited write grants; **anonymous visitors could update and delete member profiles** through `public_profiles`. Reproduced, then fixed. **This was in the Phase 1 delivery.** | ✅ |
| S2 | HIGH | Anonymous enumeration of all members via `public_profiles` | ✅ |
| S3 | HIGH | Staff could read any private evidence directly through Storage, unlogged and outside any review | ✅ |
| S4 | HIGH | Staff MFA optional and app-only | ✅ now mandatory and database-enforced |
| S5 | MEDIUM | Moderators could suspend administrators | ✅ |
| S6 | MEDIUM | Caller-chosen rate limits; direct writes and signed-out flows unlimited | ✅ |
| S10 | MEDIUM | (Introduced and caught in this phase) member MFA prompt could be skipped by editing the cookie | ✅ |
| S7 | LOW | Report and moderation integrity gaps | ✅ |
| S8 | LOW | Clients could execute trigger functions; future objects exposed by default (first fix attempt failed its test, then corrected) | ✅ |
| S9 | LOW | Staff could read unsubmitted drafts | ✅ |

Your Priority 1 items:

| # | Item | Status | Evidence |
|---|---|---|---|
| 1.1 | Inspect all SECURITY DEFINER functions | ✅ 38 of 38 set `search_path = ''`; per-function review table | SECURITY_AUDIT §2, PRIVILEGE_AUDIT.txt |
| 1.2 | Try to bypass moderation, evidence, payment locks, offer transitions | ✅ 39 adversarial DB tests + HTTP tests | `tests/db/attacks.test.ts`, `tests/integration` |
| 1.3 | Prove direct writes can't impersonate privileged RPCs | ✅ column grants, `current_user` guards, internal-only functions; `SET ROLE`/`set_config` unreachable over HTTP | attacks + integration "API boundary" |
| 1.4 | RLS with real requester, supporter, moderator and admin sessions | ✅ real Supabase Auth sessions, real TOTP MFA | integration "row-level security with real sessions" |
| 1.5 | Mandatory staff MFA: enrolment, recovery, enforcement | ✅ enrolment (QR/secret), sign-in challenge, DB enforcement (aal2), backup devices, logged admin-assisted reset, factor changes audit-logged. ⚠ Supabase recovery codes are experimental and not yet available to projects, so they aren't used | E2E "a new moderator is sent to set up MFA"; integration |
| 1.6 | Evidence only within authorised review cases | ✅ review scope (under review, open report, pending verification) + 120-second audit-logged grant enforced by storage RLS | attacks S3; integration; E2E |
| 1.7 | Distributed rate limiting for auth and marketplace actions | ✅ Postgres-backed rules shared by all instances: sign-in (IP + email), sign-up, password reset, MFA verify, submit, drafts, reports, uploads, saves, profile, roles, blocks | attacks S6; E2E "repeated failed sign-ins are rate limited" |

## 2. SQL privilege audit

- Raw output: [`PRIVILEGE_AUDIT.txt`](PRIVILEGE_AUDIT.txt), reproducible with `psql -f scripts/privilege-audit.sql` (read-only; safe to run against staging or production).
- Results: **0 tables without RLS**; the only view (`needs_public`) is SELECT-only and runs as the caller; 2 tables are deliberately client-inaccessible (`rate_limits`, `provider_events`); column-level write grants exist only on `needs`, `need_evidence`, `profiles` and `notifications`; payment, offer, agreement, payout and refund tables are client read-only (participants only); 38 of 38 definer functions have an empty `search_path`; internal functions have no client EXECUTE; future objects are not exposed by default.

## 3. Integration test results (all executed on 23 Nov 2026)

Environment: production build (`next build`) against a **from-scratch** local stack running the real **Supabase Auth (GoTrue v2.180.0)**, **PostgREST v12.2.3** and the **Supabase Storage API (v1.11.2, built from source)** on Postgres 16, plus a local SMTP catcher. Chrome 153 (desktop + Pixel 7 emulation).

| Suite | Result |
|---|---|
| Typecheck · ESLint · production build | ✅ clean |
| Unit | ✅ **41 / 41** |
| Database policy + attack | ✅ **72 / 72** (33 policy + 39 attack) |
| Integration (HTTP, real services) | ✅ **18 / 18** |
| End-to-end + accessibility (axe WCAG 2.2 A/AA) | ✅ **45 passed**, 1 skipped by design (a mobile-only test in the desktop project). Run twice in a row; both passes |
| `npm audit` | ✅ 0 vulnerabilities |

Priority 2 checklist:

| # | Item | Status |
|---|---|---|
| 2.1 | Real Storage upload, view and deletion | ✅ via API and through the app UI (fake-PDF rejection, real PDF accepted and opened) |
| 2.2 | Signed URL expiry and cross-user denial | ✅ 2-second URL fails after expiry; other members, anonymous visitors and the public URL are denied; staff denied without a grant and after it expires |
| 2.3 | Database types generated | ✅ `lib/supabase/database.types.ts` (Supabase CLI 3.3.0); clients typed; this surfaced and fixed 7 loosely typed calls |
| 2.4 | Account deletion, session revocation, recovery | ✅ deletion E2E; sign-out-others and global sign-out revoke sessions server-side; password reset by email E2E; MFA step-up aal1 → aal2 |
| 2.5 | Accessible navigation and forms on mobile | ✅ axe on 6 signed-in pages × desktop + mobile; keyboard order; collapsible dashboard menu `aria-expanded`; mobile site menu |
| 2.6 | Staging deployment | ⛔ **Blocked**: no Supabase or Vercel access (see §7) |

Infrastructure issues found and fixed along the way (not app bugs): the Storage schema needed the same client grants hosted Supabase applies; the stack script left a stale PostgREST process serving a dropped database.

## 4. Updated architecture diagram

[`ARCHITECTURE.md`](ARCHITECTURE.md) §1 (Mermaid source) · rendered: [`diagrams/architecture.png`](diagrams/architecture.png).
It shows the MFA routing, the server-token rate limiter, database enforcement (RLS + column grants, 38 definer functions, guard and rate-limit triggers, append-only audit, evidence grants, `private` schema), storage RLS tied to grants, the MFA audit trigger, and the Phase 4 provider boundary (designed, not built).

## 5. Four transaction state diagrams 📐

[`AGREEMENT_ENGINE.md`](AGREEMENT_ENGINE.md) specifies each workflow against all 11 points you listed (participants and contracts, verification, agreement formation, provider requirements, payment states, cancellation, refunds, disputes, release/payout, failed payments, audit). No generic escrow: funds are only ever held by the regulated provider, within its published limits, with a hard expiry and an automatic outcome.

| Workflow | Diagram |
|---|---|
| Shared payment states | [`diagrams/payment-states.png`](diagrams/payment-states.png) |
| 1. Give (unconditional) | [`diagrams/workflow-1-give.png`](diagrams/workflow-1-give.png) |
| 2. Earn (paid tasks) | [`diagrams/workflow-2-earn-paid-task.png`](diagrams/workflow-2-earn-paid-task.png) |
| 3. Fund (milestones) | [`diagrams/workflow-3-fund-milestones.png`](diagrams/workflow-3-fund-milestones.png) |
| 4. Solve (direct support) | [`diagrams/workflow-4-solve-direct.png`](diagrams/workflow-4-solve-direct.png) |

Requester protection (Priority 4): [`SAFEGUARDING.md`](SAFEGUARDING.md). Built and tested now: paid-work opt-in defaults to off, block/unblock with private block lists, sensitive-content and off-platform-payment detection (bank details, contact details, ID numbers, "pay me directly"…) raising moderator signals, report validation, no data link between gifts and tasks. The rest is designed for Phase 3.

## 6. Phase 3 implementation backlog

[`PHASE3_BACKLOG.md`](PHASE3_BACKLOG.md): 3 prerequisites (staging, GitHub, legal review of the [VERIFY] items) + 14 ordered items with acceptance criteria, plus the Phase 4 payment gate. Schema changes needed are listed in AGREEMENT_ENGINE §5.

## 7. Staging deployment status ⛔

**Not deployed.** I have no access to a Supabase project, Vercel account or GitHub repository for SolveANeed. Ready to deploy as soon as access exists:
1. Create a **separate** Supabase project for staging (London region), then `npx supabase link` + `npx supabase db push` (7 migrations).
2. Set `RATE_LIMIT_SERVER_TOKEN` in Vercel and store its hash (SETUP_WINDOWS §5b).
3. Vercel project (preview environment) with the env vars from `.env.example`.
4. Seed **test** data only; no payment keys (none exist yet).
5. Run `npm run test:e2e` against the staging URL with Mailpit or another test inbox.

## 8. Remaining legal and regulatory blockers

From [`COMPLIANCE_REGISTER.md`](COMPLIANCE_REGISTER.md) and AGREEMENT_ENGINE [VERIFY] items. **Block public launch:** UK GDPR DPIA, ROPA and ICO fee; Online Safety Act illegal-content risk assessment and children's access assessment; operating-entity details in the legal pages; solicitor review of Terms and Privacy. **Block Phase 4 (payments):** regulatory opinion on each fund flow (Payment Services Regulations / commercial agent exclusion); provider approval of every flow and currency, and the UK hold limit; characterisation of milestone sponsorship (conditional gift vs contract); employment-status opinion for paid tasks and a minimum effective rate; HMRC digital-platform reporting registration; consumer-law position for supplier purchases; AML thresholds.

## 9. Screenshots of implemented pages

All captured from the production build with real data (the requester, need and evidence were created through the UI; the moderator completed real TOTP MFA). In [`screenshots/`](screenshots/):

`01-home-desktop` · `02-home-mobile` · `03-how-it-works-desktop` · `04-explore-needs-desktop` · `05-create-need-desktop` · `06-manage-need-under-review-desktop` (evidence uploaded) · `07-need-public-page-desktop` / `07b-…-mobile` · `08-staff-mfa-enrolment` (secret blurred) · `09-mfa-challenge-desktop` · `10-admin-overview-desktop` · `11-admin-review-with-scoped-evidence-desktop` · `12-requester-dashboard-mobile` · `13-settings-security-mobile`

Image work (Priority 5) ✅: all 12 images reviewed; spelling correct in every image; ® removed from 11 wordmarks and checked at 4× zoom; baked-in buttons and panels cropped out; fictional figures (67%, £7,200 of £10,000, 72%) removed; banner retired and replaced by a new brand social card; one image withheld (in-person tasks, "Get Paid Securely" claim); 1.8 MB → 1.0 MB; versioned file names; inclusive set with less repetition. Details: [`IMAGE_PLAN.md`](IMAGE_PLAN.md) "Phase 2.5 review".

## 10. Commit references

⚠ **Local commits — not yet pushed.** No SolveANeed repository exists on the connected GitHub account. Hashes will stay the same when pushed.

| Commit | Content |
|---|---|
| `d90f76b` | Phase 1 baseline (as delivered before this review) |
| `da3d549` | Security hardening migration (S1–S8) + 39 attack tests |
| `db7226f` | Staff MFA UI and enforcement, distributed rate limits, scoped evidence UI, blocked members, generated DB types |
| `21ab2d5` | Integration suite (real Auth/PostgREST/Storage), E2E for MFA, evidence, rate limits, signed-in accessibility; stack script |
| `eab291b` | Image corrections and new social card |
| `c560f50` | Audit, agreement-engine, safeguarding and backlog docs; S9 |
| `57fd5b2` | S10 fix; stack script fix; regenerated types |
| `298dfd8` | Phase 2.5 handoff, final audit output, screenshots |

---

### Clearly not done
- Staging deployment ⛔ (access) · GitHub push ⛔ (no repository)
- Phase 3 UI ⬜ (deliberately not started)
- Legal opinions ⛔ (counsel)
- Supabase MFA recovery codes ⬜ (waiting for general availability)
- External penetration test ⬜ · nonce-based CSP ⬜ · storage-level upload quota ⬜

**Ready to start Phase 3 once staging and the GitHub repository exist and the founder approves the backlog.**
