# SolveANeed — Phase 4 Payment-Readiness Assessment

**Date:** 23 November 2026 · **Status:** ⛔ **Not ready for payments.** No live or test payment code exists. Live payments remain blocked in the database (`payment_transactions.livemode` is constrained to `false`).

This assessment updates the Phase 2.5 view now that the agreement layer exists. Legend: ✅ in place and tested · 🟨 partly in place · ⛔ missing / blocked.

## 1. What Phase 3 gives Phase 4 to build on

| Capability | Status | Notes |
|---|---|---|
| Immutable agreements with a SHA-256 fingerprint of the accepted terms | ✅ | `agreements.terms_snapshot` + `terms_sha256`; terms, parties, type, amount and revision limit cannot change (DB-tested) |
| Agreement state machine shared by DB and app | ✅ | `agreement_transition_allowed()` mirrored in `lib/domain/agreement-status.ts` with a parity test |
| "Funded" can only come from a provider-confirmed live payment | ✅ | `agreement_funding_status()` returns `funded` only for a `succeeded`, `livemode`, non-sandbox transaction with a provider reference. Today every agreement is `not_funded` |
| Work cannot start without payment readiness in production | ✅ | `start_task_work()` refuses unless `payment_ready_at` is set; the only bypass is the database setting `sandbox_workflows` (default **off**), which permanently marks the agreement `test_mode` |
| Append-only deal history | ✅ | `deal_events` (offer → agreement → work → review → dispute) + `audit_events` |
| Dispute record with an independent decision-maker | 🟨 | Moderator (MFA, not a party) decides `complete` or `cancel`. Partial release, appeal and evidence uploads are not built |
| Durable job runner | ✅ | Outbox + `run_jobs()` (expiry, auto-acceptance, notification delivery). Needed later for hold expiry and reconciliation |
| Server-only boundary for provider calls | 🟨 | `lib/payments/provider.ts` interface only. No webhook endpoint, no provider SDK, no keys |

## 2. Mapping Phase 3 outcomes to future money movement (design, not built)

| Agreement event | Future payment action (subject to provider approval) |
|---|---|
| Agreement created (`awaiting_payment_readiness`) | Supporter is asked to pay; charge held **by the provider** within its limit; `payment_ready_at` set only by the verified webhook |
| Readiness not reached in 72 h | Agreement `lapsed` (state exists; timer not yet built) |
| `work_accepted` / `work_auto_accepted` | Transfer (price − fee) to the requester's connected account; `payouts` row with `approved_by` |
| Dispute → `complete` | Release in full |
| Dispute → `cancel` | Full refund to the supporter via `refunds` (sum guard already prevents over-refunding) |
| Cancelled before work | Full refund / void |

## 3. Blockers before any payment code is written

| # | Blocker | Owner | Status |
|---|---|---|---|
| 1 | Regulatory opinion on each fund flow (Payment Services Regulations; commercial agent exclusion; whether SolveANeed ever "holds" funds) | Founder + counsel | ⛔ |
| 2 | Provider approval of the marketplace model, each of the four flows, currencies, and the UK maximum hold period | Founder + provider | ⛔ |
| 3 | Employment-status opinion for paid tasks and a minimum effective rate | Counsel | ⛔ |
| 4 | Characterisation of milestone sponsorship (conditional gift vs contract) and tax treatment | Counsel / accountant | ⛔ |
| 5 | HMRC digital platform reporting registration and data collection | Founder | ⛔ |
| 6 | DPIA updated for payment and KYC data | Founder + DPO | ⛔ |
| 7 | Staging environment (separate Supabase + Vercel) | Founder access | ⛔ |
| 8 | Partial-release dispute outcome and appeal | Engineering (Phase 3b) | ⛔ |
| 9 | Milestone evidence workflow (submission, review, auto-approval) | Engineering (Phase 3b) | ⛔ |
| 10 | Transactional email (offer, acceptance, submission, dispute) | Engineering + email provider | ⛔ |

## 4. Engineering checklist for Phase 4 (once 1–7 are cleared)

1. Provider in **test mode only**; keys server-side in Vercel; no card data ever reaches SolveANeed (hosted checkout / elements).
2. Webhook route with signature verification, idempotent insert into `provider_events` (unique `(provider, event_id)`, `signature_verified = true` constraint already present).
3. A single SECURITY DEFINER function per transition (`mark_payment_ready`, `record_payout`, `record_refund`), callable only by the webhook's server identity — never by members.
4. Nightly reconciliation job comparing provider balances and transactions with `payment_transactions`.
5. Fee shown before acceptance; fee stored in `agreements.platform_fee_bps` (column exists, currently 0).
6. Remove the `livemode = false` constraint **only** with written founder approval and after the checklist above passes in staging.

**Conclusion:** the data model and workflow are ready to have payments attached, but the legal, provider and staging blockers mean Phase 4 should not start yet. No funding claims should appear anywhere in the product until a provider-confirmed payment exists.
