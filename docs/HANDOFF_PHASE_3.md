# SolveANeed — Phase 3 Handoff: Offer Marketplace, Agreements, Paid Tasks, Messaging and Safety

**Date:** 23 November 2026 · **Branch:** `phase-3` · **Pull request:** [#1 → `main`](https://github.com/MyGreathouse/SolveANeed/pull/1) (not merged; awaiting founder review)
**Live payments:** not activated; still blocked in the database. **Funding claims:** none — every agreement shows *Agreed — not funded*.

Legend: ✅ completed and tested · 🟨 partly done · ⛔ blocked · ⬜ not started

---

## 1. Working Phase 3 implementation

### Development controls
| Control | Status |
|---|---|
| Feature branch, nothing developed on `main` | ✅ all work on `phase-3`; `main` unchanged since the Phase 2.5 handoff |
| CI with automated testing | ✅ GitHub Actions — 3 jobs, all green on the PR (§6) |
| Pull-request review before merging | 🟨 PR #1 opened. **Branch protection is not on yet**: the GitHub connection used here may not change repository settings (HTTP 403). Steps for the founder: `docs/SETUP_WINDOWS.md` §9. Because commits are pushed with the founder's account, required approvals are set to 0 until a second reviewer account exists |
| Live payments disabled | ✅ `livemode = false` constraint unchanged and still tested |
| S1–S10 regression tests kept | ✅ all still run in CI; a guard fails the build if any S-ID loses its test |

### Offer marketplace ✅
- **Make an offer** from a need page for the types the need accepts: Give (gift), Earn (paid task — only if the requester has opted in), Fund (milestones that must add up exactly), Solve (non-cash time, expertise or mentoring).
- **Offers Received** (requester) and **Offers Made** (supporter), with "Your response needed".
- **Accept, decline, withdraw, counter.** Turns alternate; each counter creates an immutable new version; acceptance must name the version being accepted, so stale terms are refused.
- **Immutable agreement** created on acceptance: full terms snapshot plus SHA-256 fingerprint, shown to both parties.
- **Full history** on every offer and agreement (append-only `deal_events`) and all earlier versions.
- State machines are enforced in the database (`offer_transition_allowed`, new `agreement_transition_allowed`, mirrored in TypeScript with parity tests).

### Paid-task experience ✅ (test environment)
Proposal form with deliverables, deadline, objective acceptance criteria, revisions (0–5) and cancellation policy; negotiation; agreement review; **start work**, which is only possible when the database setting `sandbox_workflows` is on, and those agreements are permanently labelled **"Test environment — no money moves"**; work submission with a private attachment; revision requests within the agreed limit; acceptance; automatic acceptance after the 7-day review window; cancellation per stage; disputes; audit history.

### Messaging and safety ✅ (with 🟨 items listed in §8)
- One conversation per offer/agreement; unread markers; private attachments (PDF/images, magic-byte checked) opened through 60-second signed links.
- Bank, card, IBAN and ID details are **refused**; phone numbers, emails and "pay me outside" are **allowed with a warning** and raise a moderator signal.
- Block and report (message, offer) from the conversation. Blocking stops new offers, counter-offers, acceptances, messages and uploads, but keeps all records for disputes.
- Moderators cannot read messages through normal queries. A **Disputes & safety** queue and **case view** let them open a conversation only while a report, dispute or unreviewed flag is open; every opening and file view is audit-logged.
- Disputes are decided only by a moderator with MFA who is not a party.
- **Durable notifications:** transactional outbox in the private schema → in-app notifications, with retries and backoff; texts are fixed and never contain message text, file names, paths or amounts. Run after every action and by `/api/jobs/run` (Vercel Cron, `CRON_SECRET`).

## 2. Database migrations
| File | Content |
|---|---|
| `supabase/migrations/20261124090000_agreement_status_values.sql` | Adds `revision_requested` and `lapsed` agreement states |
| `supabase/migrations/20261124090100_offers_agreements_messaging.sql` | Settings and rate-limit rules; non-cash offers; agreement columns and state machine; `deal_events`; notification outbox and processor; terms validation; text screening; offer RPCs; agreement and paid-task RPCs; disputes; `run_jobs`; message screening; `conversation_files` + private bucket and storage policies; staff case access; extended reports |

64 SECURITY DEFINER functions in total, all with `search_path = ''` (`docs/PRIVILEGE_AUDIT.txt`). All new tables are client read-only.

## 3. New automated tests (all executed)
| Suite | New | Total now |
|---|---|---|
| Unit | 7 (agreement parity, offer-form parsing, no "funded" label, screening messages) | 48 |
| Database (`tests/db/phase3.test.ts`) | 20 | 92 |
| Integration over real HTTP (`tests/integration/phase3.test.ts`) | 5 (incl. real Storage API policies) | 23 |
| End-to-end (`tests/e2e/deals.spec.ts`, with axe) | 11 | 56 passed + 1 skipped by design |

## 4. Screenshots of key journeys
Captured automatically during the passing E2E run, in [`screenshots/`](screenshots/):
`p3-01` requester paid-task opt-in · `p3-02` offer form validation (keeps input) · `p3-03` offer sent · `p3-04` counter-offer v2 with history · `p3-05` message screening · `p3-06` agreement *not funded* with SHA-256 · `p3-07` agreement on mobile · `p3-08` task started (test-environment banner) · `p3-09` review after resubmission · `p3-10` completed task with audit history · `p3-11` notifications · `p3-12` moderator dispute case · `p3-13` dispute resolved · `p3-14` member blocked, record kept.

## 5. Security regression results
All executed on 23 Nov 2026, locally and in CI:
- **S1–S10:** every regression test passes (database attack suite S1–S9, integration S10). The coverage guard reports all ten IDs present.
- **Phase 3 review:** no new vulnerabilities found; boundaries and tests listed in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) §5.
- **No exposure through logs, notifications or attachments:** tested (notification text checks in DB + E2E; attachments only via parties or audit-logged staff grants; no member text is written to logs; job and file routes return counts or redirects only).
- `npm audit`: 0 vulnerabilities.

## 6. CI results
PR run [45208793441](https://github.com/MyGreathouse/SolveANeed/actions/runs/45208793441) and push run [45208738257](https://github.com/MyGreathouse/SolveANeed/actions/runs/45208738257): **all 3 jobs succeeded.**
| Job | Result |
|---|---|
| Typecheck, lint (0 warnings), unit (48), S1–S10 guard, build, `npm audit` | ✅ |
| Database policy, attack and Phase 3 tests (92) + privilege audit artifact | ✅ |
| Integration (23) and E2E (56 passed, 1 skipped) on official Supabase Auth, PostgREST and Storage images | ✅ |

Early CI runs failed while the workflow was being set up (a workflow syntax error, a too-short build placeholder key, and the Storage container needing a bucket name). Those were fixed in commits `34afeee` and `0ae3ca6` and in the Storage setting inside `8099a0d`.

## 7. Staging deployment status ⛔
**Not deployed.** Still needs a separate Supabase project (London) and a Vercel project linked to the repository. When they exist: apply the 9 migrations, set the tokens (`RATE_LIMIT_SERVER_TOKEN`, `JOBS_SERVER_TOKEN`, `CRON_SECRET`, hashes per SETUP_WINDOWS §5b–5c), turn on `sandbox_workflows` **in staging only**, then run the E2E suite against the staging URL.

## 8. Outstanding blockers and gaps
**Blockers:** staging access (founder) · branch protection (founder, SETUP_WINDOWS §9) · repository visibility decision (currently public) · legal review of AGREEMENT_ENGINE [VERIFY] items (counsel).

**Not yet built (honest list):** milestone evidence/review/auto-approval · dispute evidence uploads, partial outcomes and appeal · email notifications (needs a provider) · 1-hour cooling-off before accepting paid tasks · side-by-side version diff · masking (rather than flagging) contact details · rate-limit and grant purge jobs, 72-hour readiness lapse timer · admin offer/agreement search lists and verification queue · safety guidance page · supplier purchases (Phase 4). Status per backlog item: [`PHASE3_BACKLOG.md`](PHASE3_BACKLOG.md).

## 9. Exact commit references (branch `phase-3`)
| Commit | Content |
|---|---|
| [`ddbe69b`](https://github.com/MyGreathouse/SolveANeed/commit/ddbe69b) | CI workflow, S1–S10 coverage guard, Docker runtime for the test stack |
| [`34afeee`](https://github.com/MyGreathouse/SolveANeed/commit/34afeee) | CI fix (job environment) |
| [`0ae3ca6`](https://github.com/MyGreathouse/SolveANeed/commit/0ae3ca6) | CI fix (build placeholder, failure logs) |
| [`8099a0d`](https://github.com/MyGreathouse/SolveANeed/commit/8099a0d) | Phase 3 database layer + database tests + domain modules |
| [`65ae362`](https://github.com/MyGreathouse/SolveANeed/commit/65ae362) | Phase 3 UI, actions, routes, integration and E2E tests |
| [`e1586aa`](https://github.com/MyGreathouse/SolveANeed/commit/e1586aa) | Docs, screenshots, privilege audit, strict lint |
| The commit adding this report | follows `e1586aa` on `phase-3` |

## 10. Updated Phase 4 payment-readiness assessment
[`PHASE4_PAYMENT_READINESS.md`](PHASE4_PAYMENT_READINESS.md). **Not ready.** The data model and workflow can accept payments (funding is provider-confirmed only; work can't start without readiness in production; immutable terms and history; outcome → release/refund mapping designed). Blocked by the regulatory opinion, provider approval of the flows and hold period, the employment-status and sponsorship opinions, HMRC platform reporting, the DPIA update and staging.
