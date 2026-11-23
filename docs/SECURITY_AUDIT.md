# SolveANeed — Phase 2.5 Security Audit

Scope: all SQL migrations, all `SECURITY DEFINER` functions, RLS policies, grants (tables, columns, views, functions, default privileges), storage policies, Server Actions and route handlers.
Method: automated privilege inventory (`scripts/privilege-audit.sql`, output in `PRIVILEGE_AUDIT.txt`), manual review of every function, then **adversarial tests** run as real Supabase roles (`tests/db/attacks.test.ts`) and over HTTP with real Auth/PostgREST/Storage sessions (`tests/integration/stack.test.ts`).

## 1. Findings and corrections

| ID | Severity | Finding | Correction | Proven by test | Commit |
|---|---|---|---|---|---|
| S1 | **CRITICAL** | `public_profiles` and `needs_public` views inherited Supabase's default **ALL** privileges for `anon`/`authenticated`. `public_profiles` ran with owner rights and was auto-updatable, so **anonymous visitors could UPDATE and DELETE member profiles**. Reproduced: an anonymous session renamed and then deleted a profile. Present in the Phase 1 delivery. | `public_profiles` removed. `needs_public` rebuilt (security invoker) and restricted to SELECT. Requester names come from `need_requester_public()`, which answers only for published needs. | attacks: *views (S1, S2)*; integration: *anonymous visitors cannot write through the public view* | `da3d549` |
| S2 | HIGH | `public_profiles` let anyone list every active member's name and region. | View removed; no member directory exists. | attacks: *no public view exposes profiles* | `da3d549` |
| S3 | HIGH | Staff could read **any** private evidence directly through the Storage API, bypassing the audit log, and outside any review. | Staff access requires an active review case (need under review, or an open report or verification case) **and** a 120-second grant created by `authorise_evidence_access()`, which writes the audit log. Storage RLS checks the grant. | attacks: *evidence restricted to review cases*; integration: *during review a moderator can open it only through an audit-logged grant, which expires* | `da3d549` |
| S4 | HIGH | Staff MFA was only an optional app-level check (`REQUIRE_STAFF_MFA`, default off). | `has_role()` ignores moderator/admin roles unless the session is `aal2` (setting `require_staff_mfa`, **default ON**). Every RLS policy and RPC inherits this. The app adds enrolment, challenge and routing. | attacks: *staff MFA enforced in the database*; integration: *staff roles do nothing until MFA is completed*; E2E: *a new moderator is sent to set up MFA* | `da3d549`, `db7226f` |
| S5 | MEDIUM | Moderators could suspend administrators and other moderators. | Only admins can change staff accounts; staff can't set `deletion_requested`. | attacks: *account status changes (S5)* | `da3d549` |
| S6 | MEDIUM | `check_rate_limit()` accepted caller-chosen limits; direct API writes (drafts, saves, uploads, profile edits) were unlimited; signed-out flows had no limits beyond Supabase Auth's own. | Server-defined `rate_limit_rules`; `consume_rate_limit()` (user) and `consume_anon_rate_limit()` (server-token-protected, hashed subjects); database triggers limit direct writes. Postgres-backed, so limits hold across all serverless instances. | attacks: *rate limiting (S6)*; E2E: *repeated failed sign-ins are rate limited* | `da3d549`, `db7226f` |
| S7 | LOW | Reports accepted non-existent or own targets; report status could move backwards; staff could resolve their own reports; "evidence reviewed" could be set on drafts or live needs. | Validation and forward-only transitions in the RPCs. | attacks: *reports and moderation integrity (S7)* | `da3d549` |
| S8 | LOW | Trigger functions were executable by clients; **future** functions and tables would be exposed by default (Postgres grants EXECUTE to PUBLIC; Supabase grants table privileges). | Revoked; global and schema default privileges changed. The first attempt (schema-level only) **failed its test**: PUBLIC's EXECUTE can only be removed globally, so it was fixed accordingly. | attacks: *default privileges (S8)* | `da3d549` |
| S9 | LOW | Staff could read members' unsubmitted drafts. | Staff see needs only from submission onwards. | policies: *keeps drafts private* | `c560f50` |
| S10 | MEDIUM | **Introduced and caught during Phase 2.5.** The new app-level MFA routing read "is MFA enrolled?" from the session object in the cookie, which is **not authenticated**. Someone holding a member's stolen password could edit their cookie to skip that member's optional MFA prompt. Staff were unaffected (the database checks the signed `aal` claim). Found from Supabase's "may not be authentic" server warnings during the final from-scratch verification. | `my_mfa_enrolled()` reads `auth.mfa_factors` for the verified JWT subject; used at sign-in and on every page. Server warnings went from dozens per run to 0. | integration: *MFA enrolment is read from the Auth server's factors table* | `57fd5b2` |

## 2. SECURITY DEFINER function review

All **38** definer functions in `public` and `private` (verified by query: 38 of 38) set `search_path = ''` (no search-path hijacking), fully qualified names, `auth.uid()` taken from the verified JWT, and no dynamic SQL built from user input. The only dynamic SQL is a constant trigger-creation statement. Client EXECUTE rights:

| Function | Clients | Caller check | Notes |
|---|---|---|---|
| `has_role`, `is_staff`, `is_active_user` | anon, auth | Current user only | Cannot probe other accounts |
| `my_mfa_enrolled` | auth | Current user only | Reads `auth.mfa_factors` (S10) |
| `my_roles` | auth | Current user only | Raw roles for MFA routing |
| `need_requester_public` | anon, auth | Published needs only; members-only needs require sign-in | Replaces `public_profiles` |
| `submit_need`, `close_need` | auth | Owner + requester role + active; rate-limited | Validation, duplicates, sensitive-content signal |
| `moderate_need`, `resolve_report`, `moderation_stats`, `mark_risk_signal_reviewed` | auth | `is_staff()` (aal2) | Self-moderation blocked |
| `admin_set_role`, `admin_set_platform_setting`, `record_staff_mfa_reset` | auth | `has_role('admin')` (aal2) | Can't remove own admin role or record own reset |
| `admin_set_account_status` | auth | Staff; admins only for staff targets | Reason required |
| `authorise_evidence_access` | auth | Owner, or staff within review scope | Creates grant + audit log |
| `submit_report`, `block_user`, `unblock_user`, `my_blocked_users`, `set_my_role`, `request_account_deletion`, `mark_all_notifications_read`, `consume_rate_limit` | auth | Self only; active; rate-limited | — |
| `consume_anon_rate_limit` | anon, auth | Server token (sha256 compared) | Subjects must be sha256 digests |
| `log_audit`, `notify_user`, `check_rate_limit`, `purge_rate_limits`, `is_blocked_between`, `handle_new_user`, `enforce_rate_limit`, `audit_mfa_factor_change`, `private.hit` | **none** | Internal | Verified not callable over HTTP |

## 3. Trust boundaries (and how each was tested)

1. **Browser → Next.js server:** Server Actions re-check the session (`requireViewer`/`requireRole`/`requireStaff`); Next.js checks the request origin.
2. **Next.js / browser → Supabase:** only the publishable key; no service-role key in the app. Clients reach Postgres only through PostgREST, which exposes the `public` schema's tables, views and functions. **Tested over HTTP:** `set_config`, the `private` schema and internal functions are unreachable.
3. **PostgREST → Postgres:** the database trusts the JWT claims PostgREST sets after verifying the signature. Role switching (`SET ROLE`) needs raw SQL, which clients never have.
4. **Direct writes vs privileged RPCs:** guard triggers detect direct client writes with `current_user in ('anon','authenticated')` (inside definer functions `current_user` is the owner). Column-level grants stop clients naming protected columns at all. **Tested:** owners can't set `status`, `funded_minor`, `evidence_reviewed_at`, `published_at` or `requester_id`, and can't write moderation, audit, risk, notification, grant or rate-limit tables.

## 4. Residual risks (accepted for now, tracked)

| Risk | Mitigation / plan |
|---|---|
| Storage object uploads aren't rate-limited by the database (only the evidence **row** is). | Bucket size and type limits; storage RLS limits uploads to the owner's editable needs. Add a storage-level quota or scheduled orphan clean-up in Phase 3. |
| The anonymous limiter **fails open** if `RATE_LIMIT_SERVER_TOKEN` or its hash is missing. | Deliberate (avoids locking everyone out). Logged. Staging and production checklist requires it. Supabase Auth's own limits still apply. |
| Supabase MFA recovery codes aren't generally available (the SDK marks them experimental and not yet available to projects). | Staff enrol 2 authenticator devices; admin-assisted reset in the Supabase dashboard recorded with `record_staff_mfa_reset()`; factor changes auto-logged by a trigger on `auth.mfa_factors`. |
| Access tokens stay cryptographically valid until expiry (default 1 hour) after sign-out. | The app verifies sessions server-side on each request (`getClaims` → Auth server with HS256); revoked sessions are rejected. Integration-tested. Consider shorter JWT expiry in production. |
| CSP allows `'unsafe-inline'` scripts. | Nonce-based CSP before launch. |
| No external penetration test. | Before public launch. |

---

## 5. Phase 3 review (23 Nov 2026)

Scope: migrations `20261124090000` and `20261124090100`, the new Server Actions (`app/dashboard/deals/actions.ts`, `app/admin/actions.ts`), route handlers `/api/files/[id]` and `/api/jobs/run`, and the `conversation-files` storage policies.

**Result:** no new vulnerabilities found in the review; all Phase 2.5 corrections (S1–S10) still pass (see the handoff for test runs). Function count is now **64 SECURITY DEFINER functions, all with `search_path = ''`** ([`PRIVILEGE_AUDIT.txt`](PRIVILEGE_AUDIT.txt)). Every new table is client **read-only** under RLS; there are no new column write grants.

| Boundary | Control | Tested by |
|---|---|---|
| Offers, versions, agreements, deal events, messages, files | No client INSERT/UPDATE/DELETE; changes only through definer RPCs that check caller, state machine, blocks, active status and rate limits | `tests/db/phase3.test.ts` ("clients cannot write …"), integration |
| Negotiation integrity | Turn-taking (`last_proposed_by`), optimistic version check (`p_expected_version`, error 40001), immutable `offer_versions`, frozen accepted terms | db + E2E |
| Funding claims | `agreement_funding_status()` can only say `funded` for a live, provider-confirmed payment, which the database still forbids | db + E2E ("not funded") |
| Paid work without payment | Blocked unless `sandbox_workflows` is on; such agreements are permanently `test_mode` (cannot be relabelled) | db + E2E |
| Messages | Parties only (RLS); immutable; bank/card/IBAN/ID details refused; contact/off-platform details flagged with a reviewer signal | db + integration + E2E |
| Staff access to conversations | Not via RLS. `staff_read_conversation()` only while a report, dispute or unreviewed flag is open; every view audit-logged; MFA required | db + E2E |
| Attachments | Private bucket; uploads only into the caller's own folder of a conversation they belong to and aren't blocked in; no member deletes; staff only via a 120-second audit-logged grant inside a case | integration (real Storage API) |
| Blocks | Stop new offers, counters, acceptances, messages and uploads; records stay readable for disputes | db + integration + E2E |
| Notifications | Fixed texts per type; never message bodies, file names, storage paths or member-typed amounts; outbox is in the `private` schema | db ("never contain …") + E2E |
| Background jobs | `run_jobs()` requires the server token (sha256 compared in the DB); `/api/jobs/run` requires `CRON_SECRET` (constant-time compare) and returns counts only | db + integration |
| Disputes | Decided only by staff with MFA who are **not** a party | db + E2E |

### Accepted by design (documented)
- `need_accepts_paid_tasks()` tells any signed-in member whether a **published** need's requester is open to paid tasks — needed to show the option; reveals nothing else.
- `conversation_member()` answers only for the caller.
- A message that trips the contact/off-platform detector brings its conversation into staff scope until a moderator marks the signal reviewed. This is a safeguarding choice; it is logged and visible in the admin console.

### New residual risks
| Risk | Plan |
|---|---|
| Contact details are flagged, not masked. | Consider masking before launch (backlog). |
| No email notifications yet (in-app only). | Needs an email provider; outbox is ready. |
| Background jobs run from a Cloudflare Cron Trigger every 15 minutes (`custom-worker.ts` → `/api/jobs/run`). | Member actions also trigger job runs, so notifications arrive promptly even between cron runs. |
