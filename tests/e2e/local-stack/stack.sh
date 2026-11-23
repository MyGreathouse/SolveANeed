#!/usr/bin/env bash
# Rebuilds the local SolveANeed integration stack from scratch.
set -euo pipefail
E2E=${E2E_DIR:?set E2E_DIR to the folder holding auth, postgrest, storage, node26}; APP=${APP_DIR:-$(cd "$(dirname "$0")/../../.." && pwd)}
export PGPASSWORD=postgres
DB=solveaneed_e2e
JWT_SECRET=$(cat $E2E/jwt_secret)

# Processes are started with relative paths, so match on the binary name.
pkill -x auth || true; pkill -x postgrest || true; pkill -f gateway.mjs || true
pkill -f "dist/start/server.js" || true; pkill -f smtp.py || true; pkill -f "http.server 8099" || true
sleep 1

psql -h localhost -U postgres -q -c "drop database if exists $DB with (force)" -c "create database $DB"
psql -h localhost -U postgres -d $DB -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login password 'authpw' noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login password 'authpw' superuser createrole; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema auth authorization supabase_auth_admin;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL

mkdir -p $E2E/mail $E2E/storage-data
(cd $E2E && nohup python3 smtp.py > smtp.log 2>&1 &)
(cd $APP/supabase/templates && nohup python3 -m http.server 8099 --bind 127.0.0.1 > $E2E/tpl.log 2>&1 &)
(cd $E2E && set -a && . ./auth.env && set +a && nohup ./auth > auth.log 2>&1 &)
for i in $(seq 1 60); do
  [ "$(psql -h localhost -U postgres -d $DB -tAc "select to_regprocedure('auth.uid()') is not null")" = "t" ] && \
  [ "$(psql -h localhost -U postgres -d $DB -tAc "select to_regclass('auth.mfa_factors') is not null")" = "t" ] && break
  sleep 1
done
psql -h localhost -U postgres -d $DB -q -c "grant execute on function auth.uid() to anon, authenticated, service_role"

# Supabase Storage API (file backend); runs its own storage-schema migrations.
(cd $E2E/storage && PATH=$E2E/node26/package/bin:$PATH \
  SERVER_HOST=127.0.0.1 SERVER_PORT=5000 SERVER_ADMIN_PORT=5001 SERVER_REGION=local \
  AUTH_JWT_SECRET=$JWT_SECRET AUTH_JWT_ALGORITHM=HS256 \
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/$DB \
  DB_INSTALL_ROLES=false DB_ANON_ROLE=anon DB_SERVICE_ROLE=service_role DB_AUTHENTICATED_ROLE=authenticated \
  DB_SUPER_USER=postgres DB_ALLOW_MIGRATION_REFRESH=true \
  STORAGE_BACKEND=file STORAGE_FILE_BACKEND_PATH=$E2E/storage-data TENANT_ID=stub \
  UPLOAD_FILE_SIZE_LIMIT=52428800 UPLOAD_SIGNED_URL_EXPIRATION_TIME=60 IMAGE_TRANSFORMATION_ENABLED=false \
  ANON_KEY=$(cat $E2E/anon_key) \
  nohup node dist/start/server.js > $E2E/storage.log 2>&1 &)
for i in $(seq 1 60); do curl -sf localhost:5000/status >/dev/null && break; sleep 1; done
curl -s localhost:5000/status; echo
# Mirror hosted Supabase: client roles may use the storage schema; RLS decides access.
psql -h localhost -U postgres -d $DB -q -c "grant usage on schema storage to anon, authenticated, service_role" \
  -c "grant all on all tables in schema storage to anon, authenticated, service_role" \
  -c "grant all on all functions in schema storage to anon, authenticated, service_role"

for f in $APP/supabase/migrations/*.sql; do psql -h localhost -U postgres -d $DB -v ON_ERROR_STOP=1 -q -f $f; done
# Server token for anonymous rate limits (value in .env.local as RATE_LIMIT_SERVER_TOKEN)
# TEST STACK ONLY: throwaway token for the local stack (set the same value as
# RATE_LIMIT_SERVER_TOKEN in .env.local). Never reuse it in staging/production.
STACK_TOKEN=${STACK_RATE_LIMIT_TOKEN:-e2e-rate-limit-token}
psql -h localhost -U postgres -d $DB -q -c "insert into private.app_secrets (name, value_hash) values ('rate_limit_server_token', encode(sha256('$STACK_TOKEN'::bytea), 'hex'))"

# Test stack only: every browser test comes from 127.0.0.1, so per-IP limits are raised.
# Per-email and per-user limits keep their production values.
psql -h localhost -U postgres -d $DB -q -c "update public.rate_limit_rules set max_hits = 1000 where action in ('sign_in_ip','sign_up_ip','password_reset_ip')"
(cd $E2E && nohup ./postgrest postgrest.conf > postgrest.log 2>&1 &)
(cd $E2E && nohup node gateway.mjs > gateway.log 2>&1 &)
sleep 3
echo "stack up"
