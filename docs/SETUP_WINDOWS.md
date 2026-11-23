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

Generate a secret, put it in `.env.local` (and in Vercel) as `RATE_LIMIT_SERVER_TOKEN`, then store **only its hash** in the database:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```sql
-- Supabase SQL editor (replace the value)
insert into private.app_secrets (name, value_hash)
values ('rate_limit_server_token', encode(sha256('PASTE-THE-SECRET-HERE'::bytea), 'hex'))
on conflict (name) do update set value_hash = excluded.value_hash, updated_at = now();
```

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

## 8. Deploy to Vercel

1. Push the code to a **private** GitHub repository and import it in Vercel.
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://solveaneed.com` and `RATE_LIMIT_SERVER_TOKEN`.
3. Add the domain `solveaneed.com` in Vercel and update the Supabase Site URL and redirect URLs to match.

## Troubleshooting

| Symptom | Fix |
|---|---|
| “Preview mode” warning on sign-up | `.env.local` is missing or has the wrong keys. Restart `npm run dev` after editing it |
| Email link says it has expired | Links are single-use. Request a new one. Check the Site URL and redirect URLs |
| `permission denied` errors | Make sure **all** migrations ran, in order (`npx supabase db push`) |
| PowerShell blocks `npx` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once |
