# Setting up SolveANeed on Windows

These steps use a **hosted Supabase project**, so you don't need Docker. Commands are for PowerShell or Windows Terminal.

## 1. Install tools (once)

1. **Node.js 22 LTS**: https://nodejs.org (tick “Add to PATH”). Check with `node -v`.
2. **Git**: https://git-scm.com/download/win
3. A code editor such as VS Code.

## 2. Get the code

Unzip `solveaneed.zip` (or clone your GitHub repo), then:

```powershell
cd solveaneed
npm install
```

## 3. Create the Supabase project

1. Create a project at https://supabase.com. Choose a **London (eu-west-2)** region for UK data residency.
2. In the project's API settings, copy the **Project URL** and the **publishable (anon) key**.
3. Copy the env template and fill it in:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

## 4. Apply the database migrations

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This creates every table, security policy, function and the private evidence bucket. (Alternative: paste each file from `supabase/migrations` into the SQL editor **in filename order**.)

## 5. Configure Supabase Auth (dashboard)

- **Email sign-in:** enabled, **Confirm email: ON**, minimum password length **12**. Turn on leaked-password protection if your plan has it.
- **URL configuration:** Site URL `http://localhost:3000` for local work, or `https://solveaneed.com` in production. Add redirect URLs `http://localhost:3000/**` and `https://solveaneed.com/**`.
- **Email templates:** paste the HTML from `supabase/templates/confirmation.html`, `recovery.html` and `email_change.html` into the matching templates. These send links to `/auth/confirm`, which the app needs.
- **SMTP:** Supabase's built-in email is heavily rate-limited and only meant for testing. Before launch, set up custom SMTP, for example through your existing Zoho Mail business account, sending from an address such as `no-reply@solveaneed.com`.

## 5b. Rate-limit server token

Generate a secret, put it in `.env.local` (and as a Cloudflare Worker secret) as `RATE_LIMIT_SERVER_TOKEN`, then store **only its hash** in the database:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```sql
-- Supabase SQL editor (replace the value)
insert into private.app_secrets (name, value_hash)
values ('rate_limit_server_token', encode(sha256('PASTE-THE-SECRET-HERE'::bytea), 'hex'))
on conflict (name) do update set value_hash = excluded.value_hash, updated_at = now();
```

## 5c. Background jobs token and cron (Phase 3)

Notifications, offer expiry and task auto-acceptance run through `run_jobs()`.

1. Generate a token: `openssl rand -hex 32`. Store it as a Cloudflare Worker **secret** named `JOBS_SERVER_TOKEN`.
2. In the Supabase SQL editor, store **only its hash**:
   ```sql
   insert into private.app_secrets (name, value_hash)
   values ('jobs_server_token', encode(sha256('PASTE-TOKEN-HERE'::bytea), 'hex'))
   on conflict (name) do update set value_hash = excluded.value_hash, updated_at = now();
   ```
3. Store `CRON_SECRET` (another random value) as a Cloudflare Worker **secret**. The Cron Trigger in `wrangler.jsonc` runs every 15 minutes and calls `/api/jobs/run` through `custom-worker.ts`.

**Test environment only:** to let paid-task workflows run without payments, an admin (with MFA) runs
`select public.admin_set_platform_setting('sandbox_workflows', 'true');` in **staging**. Never in production. Agreements started this way are permanently labelled "Test environment — no money moves".

## 6. Run it

```powershell
npm run dev
```

Open http://localhost:3000, create an account and verify it through the email link.

## 7. Make yourself an administrator

In the Supabase SQL editor (replace the email):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict do nothing;
```

Sign out and back in, then open **/admin**. You'll be sent to **Settings → Two-step verification** first: scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), enter the code, then **add a second device as a backup**. Staff roles have no effect in the database until MFA is completed in that session.

**Lost both devices?** Another administrator removes your MFA factors in the Supabase dashboard (Authentication → Users), then records it with `select public.record_staff_mfa_reset('<your user id>', '<reason>');`. If you are the only administrator, keep your backup device somewhere safe: there's nobody to reset it except through direct database access.

## 8. Deploy to Cloudflare Workers (staging)

SolveANeed runs as a Cloudflare **Worker** using the official OpenNext adapter (`wrangler.jsonc`, `open-next.config.ts`, `custom-worker.ts`). Workers Paid (about $5/month) is recommended: the free plan's size and CPU limits are likely too small for this app.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → GitHub → `MyGreathouse/SolveANeed`.
2. Project name: **`solveaneed-staging`** (must match `name` in `wrangler.jsonc`). Production branch: `main` (or `phase-3` until it is merged). Leave the root directory empty.
3. Build command: `npx opennextjs-cloudflare build` · Deploy command: `npx opennextjs-cloudflare deploy`.
4. **Build variables** (Settings → Build → Variables) — these are baked into the browser code at build time:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://bldrvexnroetqkmtbjus.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the publishable key from docs/STAGING.md
   - `NEXT_PUBLIC_SITE_URL` = the Worker address, e.g. `https://solveaneed-staging.<your-subdomain>.workers.dev`
5. **Secrets** (Settings → Variables and Secrets → Add → type *Secret*): `RATE_LIMIT_SERVER_TOKEN`, `JOBS_SERVER_TOKEN`, `CRON_SECRET` (values from the private staging secrets file).
6. Deploy, then in Supabase → Authentication → URL Configuration set **Site URL** to the Worker address and add `https://<worker address>/**` to **Redirect URLs**.

Local preview on the Workers runtime: create `.dev.vars` (same keys as `.env.local`) and run `npm run cf:preview`.

## 9. Protect the `main` branch on GitHub (one-time, founder)

Claude cannot change repository settings, so please do this in the browser:

1. GitHub → **MyGreathouse/SolveANeed** → **Settings** → **Branches** → **Add branch ruleset** (or "Add rule").
2. Target branch: `main`.
3. Turn on: **Require a pull request before merging** (required approvals: 0 now, 1 once you add a reviewer account) · **Dismiss stale approvals** · **Require conversation resolution**.
4. Turn on **Require status checks to pass**, tick **Require branches to be up to date**, and add these three checks (they appear after the first CI run):
   - `Typecheck, lint, unit, build, audit`
   - `Database policy and attack tests`
   - `Integration and end-to-end (real Auth, PostgREST, Storage)`
5. Turn on **Block force pushes** and **Restrict deletions**; apply to administrators too.
6. Optional but recommended: Settings → General → make the repository **Private** before launch.

## Troubleshooting

| Symptom | Fix |
|---|---|
| “Preview mode” warning on sign-up | `.env.local` is missing or has the wrong keys. Restart `npm run dev` after editing it |
| Email link says it has expired | Links are single-use. Request a new one. Check the Site URL and redirect URLs |
| `permission denied` errors | Make sure **all** migrations ran, in order (`npx supabase db push`) |
| PowerShell blocks `npx` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once |
