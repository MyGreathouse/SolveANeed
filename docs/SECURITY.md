# SolveANeed — Security

How each requirement in §19 of the build directive is met, and where it is verified. "DB test" means `tests/db/policies.test.ts`; "E2E" means `tests/e2e/*.spec.ts`.

| Requirement | Implementation | Verified by |
|---|---|---|
| Least privilege | No service-role key in the app. Explicit revokes plus column grants | DB test |
| Server-side permission checks | `requireViewer`/`requireRole`/`requireStaff` on every page and action, then RLS | E2E (other user's need returns 404, `/admin` returns 404) |
| Input validation | Zod schemas (`lib/domain/validation.ts`), DB CHECK constraints, `submit_need()` checks | Unit + DB test |
| Rate limiting | Server-defined `rate_limit_rules` in Postgres (shared by all serverless instances): submissions, drafts, reports, uploads, saves, profile edits, role changes, blocks; signed-out sign-in/sign-up/reset/MFA via a server token with hashed subjects | DB attack tests + E2E (sign-in lockout) |
| CSRF | Server Actions check the request origin. Session cookies are SameSite=Lax | Framework behaviour |
| XSS | React escaping, no `dangerouslySetInnerHTML` except escaped JSON-LD, CSP | E2E (headers) |
| Secure uploads | Type allowlist, 10 MB limit, signature-byte check, safe file names, random object names | Integration (real Storage API) + E2E (fake PDF rejected, real PDF accepted) |
| Private storage and signed access | Private bucket; storage RLS (owner, or staff with a 120-second audit-logged grant inside a review case); 60-second signed URLs | DB attack tests + integration (expiry, cross-user denial) |
| Webhook signatures and idempotency | Schema only: `provider_events` requires verification; unique keys | DB test (schema) |
| Session management | Supabase cookies refreshed in `proxy.ts`; sign out of other devices or everywhere; other sessions revoked after a password change | E2E (reset flow) |
| Audit logging | `audit_events`, append-only, written only by definer functions | DB + E2E |
| Secret management | `.env.example` only. Secrets live in Vercel/Supabase env | — |
| Dependency checks | `npm audit` (0 vulnerabilities at build time). Enable Dependabot on the repo | — |

### Threats specifically prevented

| Threat | Control |
|---|---|
| Access to others' needs (IDOR) | RLS by `requester_id`; IDs are random UUIDs; queries filter by owner as well | 
| Access to private evidence | Owner/staff RLS on rows and storage objects; the bucket is never public |
| Manipulation of offer amounts | No client write grants; accepted terms are immutable (trigger); amount fields are locked after acceptance |
| Duplicate payment execution | Unique `idempotency_key`; unique `(provider, provider_ref)` |
| Forged payment status | Only signature-verified provider events can be stored; clients can't write payment tables |
| Unauthorised payout release | Payouts must record an approver to move past `pending`; no client writes |
| Privilege escalation | Roles changed only via `set_my_role` (requester/supporter only) or `admin_set_role` (admin) |
| Self-moderation | `moderate_need` blocks moderators from deciding on their own needs |
| Open redirects | `safeNextPath()`; email links are reduced to same-origin paths |
| Account enumeration | Sign-up and password reset return the same response whether or not the account exists |

### Security headers (next.config.ts)
CSP (`frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), HSTS (2 years, preload), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and `poweredByHeader: false`.

> Phase 2.5: see **`SECURITY_AUDIT.md`** for findings S1–S9 and the definer-function review. Staff MFA is now mandatory and database-enforced.

### Before launch
- Configure `RATE_LIMIT_SERVER_TOKEN` and its hash; enrol all staff in MFA with backup devices.
- Turn on Supabase leaked-password protection, require email confirmation, and use custom SMTP.
- Move to a nonce-based CSP (removes `'unsafe-inline'` for scripts).
- Get an external penetration test. Enable the Supabase security advisor and fix its findings.
