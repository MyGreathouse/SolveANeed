# SolveANeed — Database

Postgres on Supabase. All schema changes are versioned SQL migrations in `supabase/migrations` (apply with `npx supabase db push`). Never edit the schema by hand in production.

| Migration | Contents |
|---|---|
| `20261123090000_foundation.sql` | Enums, `currencies` (multi-currency reference data), `need_categories`, `profiles`, `user_roles`, role helpers, `audit_events` (append-only), `rate_limits`, `risk_signals`, `notifications`, new-user trigger (enforces 18+ and terms acceptance), role and account-status RPCs |
| `20261123090100_needs.sql` | `needs` (status machine, generated funding progress, full-text search), `need_evidence`, `saved_needs`, `support_preferences`, `reports`, `moderation_actions` (append-only), `verification_cases`, `needs_public` view, RPCs `submit_need`, `close_need`, `moderate_need`, `submit_report`, `resolve_report`, `request_account_deletion` |
| `20261123090200_agreements_payments.sql` | `organisations`, `organisation_members`, `offers` (+ transition guard), `offer_versions` (immutable), `agreements` (immutable terms + SHA-256), `agreement_milestones`, `task_deliverables`, `contributions`, `payment_transactions` (live mode blocked), `provider_events`, `payouts`, `refunds`, `disputes`, `dispute_evidence`, `conversations`, `messages`. Participants can read; there are no client write policies yet |
| `20261123090300_storage.sql` | Private `need-evidence` bucket (10 MB, PDF/JPEG/PNG/WebP) and storage RLS policies |
| `20261123090400_evidence_access_and_stats.sql` | `authorise_evidence_access` (audit-logged staff access), `mark_all_notifications_read`, `moderation_stats`, `mark_risk_signal_reviewed` |
| `20261123110000_security_hardening.sql` | **Phase 2.5** — fixes S1–S9 (see `SECURITY_AUDIT.md`): removes `public_profiles`, read-only `needs_public`, DB-enforced staff MFA (`platform_settings`, `current_aal()`), `rate_limit_rules` + `consume_rate_limit` / `consume_anon_rate_limit` + write triggers, `private` schema, scoped evidence grants, `user_blocks` + RPCs, `detect_sensitive_content`, MFA audit trigger, default-privilege hardening; staff can't read unsubmitted drafts (S9) |
| `20261123120000_mfa_enrolment_check.sql` | **Phase 2.5** — `my_mfa_enrolled()` reads `auth.mfa_factors` for the verified user (S10) |

All 27 tables listed in the build directive exist, plus supporting tables: `currencies`, `need_categories`, `saved_needs`, `rate_limits`, `risk_signals`.

## Conventions

- **Money:** `*_minor BIGINT` + `currency CHAR(3) REFERENCES currencies`. Never floats. Never mixed across currencies.
- **Keys:** UUID v4 (`gen_random_uuid()`); the audit log uses a bigint identity.
- **Timestamps:** `timestamptz`, with `updated_at` maintained by trigger.
- **Privileged writes:** Protected columns can only be changed inside `SECURITY DEFINER` functions. Guard triggers use `current_user in ('anon','authenticated')` to detect direct client writes, which can't be spoofed through PostgREST. Every function sets `search_path = ''`.
- **Grants:** Supabase grants broad table privileges by default, so each migration revokes them from `anon`/`authenticated` and grants back only what's needed, down to column level for `needs`, `profiles` and `notifications`.
- **Append-only:** `audit_events`, `moderation_actions` and `offer_versions` reject UPDATE and DELETE.

## Data retention (draft — needs legal sign-off)

| Data | Proposed retention |
|---|---|
| Drafts | Deleted immediately on account deletion request |
| Profiles after deletion request | Anonymised immediately; hard-deleted after the retention review |
| Published/closed needs | Kept while the account is active; anonymised on deletion |
| Evidence files | Deleted with the draft; reviewed on need closure (proposed: 12 months) |
| Moderation and audit logs | Proposed 6 years (fraud and regulatory defence) |
| Payment records (Phase 4) | As required by HMRC / AML rules (typically 5–6 years) |
| Rate-limit windows | 2 days (`purge_rate_limits()`) |

The final hard deletion of `auth.users` is an administrative step run with the service role outside the web app, after these checks.

## Generated TypeScript types

```bash
npm run db:types   # supabase gen types typescript --linked --schema public
```
Done in Phase 2.5: `lib/supabase/database.types.ts` is generated (Supabase CLI 3.3.0) and both clients are typed with it. Regenerate after every migration.
