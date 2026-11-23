# SolveANeed — Security

How each requirement in §19 of the build directive is met, and where it is verified. "DB test" means `tests/db/policies.test.ts`; "E2E" means `tests/e2e/*.spec.ts`.

| Requirement | Implementation | Verified by |
|---|---|---|
| Least privilege | No service-role key in the app. Explicit revokes plus column grants | DB test |
| Server-side permission checks | `requireViewer`/`requireRole`/`requireStaff` on every page and action, then RLS | E2E (other user's need returns 404, `/admin` returns 404) |
| Input validation | Zod schemas (`lib/domain/validation.ts`), DB CHECK constraints, `submit_need()` checks | Unit + DB test |
| Rate limiting | DB-backed `check_rate_limit()`: need submission (5/day), reports (10/h), uploads (30/h). Auth endpoints use Supabase's built-in limits | DB test (submissions) |
| CSRF | Server Actions check the request origin. Session cookies are SameSite=Lax | Framework behaviour |
| XSS | React escaping, no `dangerouslySetInnerHTML` except escaped JSON-LD, CSP | E2E (headers) |
| Secure uploads | Type allowlist, 10 MB limit, signature-byte check, safe file names, random object names | Unit-level code review only; **upload path not run end to end** (see handoff) |
| Private storage and signed access | Private bucket, storage RLS, 60-second signed URLs, staff access audit-logged | DB test |
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

### Before launch
- Set `REQUIRE_STAFF_MFA=true`, build an MFA enrolment screen, and enrol all staff.
- Turn on Supabase leaked-password protection, require email confirmation, and use custom SMTP.
- Move to a nonce-based CSP (removes `'unsafe-inline'` for scripts).
- Get an external penetration test. Enable the Supabase security advisor and fix its findings.
