# SolveANeed — Staging environment

| Item | Value |
|---|---|
| Supabase project | `solveaneed-staging` (ref `bldrvexnroetqkmtbjus`), organisation RistenGlobal, **free plan** |
| Region | London (`eu-west-2`), Postgres 17 |
| API URL | `https://bldrvexnroetqkmtbjus.supabase.co` |
| Publishable key | `sb_publishable_v-qjPCLaC8hhfUcLlpidSQ_JqpNVB8I` (public by design; RLS protects data) |
| Created | 23 Nov 2026 |

## Database
All 9 migrations applied on 23 Nov 2026. The last one was applied in three parts (`offers_agreements_messaging_part1..3`) so Supabase's confirmation prompt only covered the three constraint replacements; the SQL is identical to `20261124090100_offers_agreements_messaging.sql`.

**Verified identical to the tested local stack** (functions, function permissions, RLS policies incl. storage, columns, constraints, table and column grants, RLS flags, triggers incl. `auth.users` and `auth.mfa_factors`, storage buckets) by comparing schema fingerprints.

## Settings (staging only)
- `sandbox_workflows = true` — paid-task workflows can run without payments; such agreements are permanently `test_mode`. **Never enable in production.**
- `require_staff_mfa = true`.
- `rate_limit_server_token` and `jobs_server_token` hashes stored in `private.app_secrets`. The tokens themselves are held only in the host's secret store.

## Supabase advisor results (23 Nov 2026)
- **Security:** no errors. Info/warnings are by design: deny-all tables with RLS and no policies (grants, rate limits, provider events); SECURITY DEFINER RPCs callable by signed-in users (the app's write API — every function checks the caller); 7 anon-callable helpers (`has_role`, `is_staff`, `is_active_user`, `setting_bool`, `need_requester_public` answer only about the caller or published needs; `consume_anon_rate_limit` and `run_jobs` require the server token).
- **Performance:** 39 RLS policies call `auth.uid()` per row (`auth_rls_initplan`) — wrap as `(select auth.uid())` in a follow-up migration before launch; 61 unindexed foreign keys and unused-index notices (empty database) — review with real traffic.

## Still to do
Auth settings in the dashboard (site URL, redirect URLs, SMTP sender), Cloudflare deployment, first admin account, E2E run against the staging URL.
