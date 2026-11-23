# Lightweight local stack (Linux / CI)

The **recommended** way to run end-to-end tests is the official Supabase CLI
(`supabase start`, needs Docker Desktop) — see `docs/TESTING.md`.

This folder documents the lighter stack used to run the Phase 1 E2E suite in a
Docker-less Linux environment. It runs the *real* Supabase Auth (GoTrue
v2.180.0) and PostgREST (v12.2.3) binaries against Postgres 16, behind a tiny
path-routing gateway so `supabase-js` sees a single URL.

Phase 2.5 added the **real Supabase Storage API** (built from github.com/supabase/storage, file backend, Node 26), so evidence upload, signed URLs and storage RLS are now tested end to end. Realtime is not included.

| Component | Port | Notes |
|---|---|---|
| Postgres 16 | 5432 | database `solveaneed_e2e` |
| GoTrue (auth) | 9999 | migrates the `auth` schema itself |
| PostgREST | 3001 | `db-anon-role = anon`, HS256 `jwt-secret` shared with GoTrue |
| Storage API | 5000 | runs its own `storage` schema migrations |
| gateway.mjs | 54321 | `/auth/v1/*` → 9999, `/rest/v1/*` → 3001, `/storage/v1/*` → 5000 |
| smtp-catcher.py | 2525 | writes emails to `$MAIL_DIR` (`pip install aiosmtpd`) |
| template server | 8099 | `python -m http.server` in `supabase/templates` |

Order: create roles (`anon`, `authenticated`, `service_role`, `authenticator`,
`supabase_auth_admin`) and an empty `storage` schema stub (see
`tests/db/supabase-stub.sql`, storage part only) → start GoTrue (it creates
`auth.*`) → apply `supabase/migrations/*.sql` → start PostgREST and the gateway
→ sign an anon JWT with the shared secret → build and start the app.

Then run:

```bash
E2E_MAIL_DIR=./mail E2E_DATABASE_URL=postgres://postgres:postgres@localhost:5432/solveaneed_e2e \
  CHROME_PATH=/usr/bin/google-chrome npx playwright test
```

`stack.sh` rebuilds everything from scratch (`E2E_DIR=/path/to/binaries ./stack.sh`). Test-stack only: per-IP rate limits are raised because every test runs from 127.0.0.1; per-email and per-user limits keep production values.
