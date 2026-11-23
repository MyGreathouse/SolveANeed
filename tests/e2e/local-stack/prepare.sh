#!/usr/bin/env bash
# Creates a throwaway local-stack folder (secrets, keys, service configs) for CI
# or a fresh machine. TEST STACK ONLY: every value here is random or a fixed
# test password and must never be reused in staging or production.
set -euo pipefail
E2E=${E2E_DIR:?set E2E_DIR}; HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$E2E/mail" "$E2E/storage-data"
[ -f "$E2E/jwt_secret" ] || openssl rand -hex 32 > "$E2E/jwt_secret"
SECRET=$(cat "$E2E/jwt_secret")
sign() { node -e '
  const c=require("node:crypto"),[s,role]=process.argv.slice(1),b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
  const h=b({alg:"HS256",typ:"JWT"}),p=b({role,iss:"supabase",iat:1700000000,exp:2000000000});
  process.stdout.write(h+"."+p+"."+c.createHmac("sha256",s).update(h+"."+p).digest("base64url"));' "$SECRET" "$1"; }
sign anon > "$E2E/anon_key"; sign service_role > "$E2E/service_key"
cp "$HERE/gateway.mjs" "$HERE/smtp-catcher.py" "$E2E/"
cat > "$E2E/auth.env" <<ENV
GOTRUE_API_HOST=127.0.0.1
PORT=9999
API_EXTERNAL_URL=http://localhost:54321/auth/v1
GOTRUE_DB_DRIVER=postgres
DATABASE_URL="postgres://supabase_auth_admin:authpw@localhost:5432/solveaneed_e2e?search_path=auth&sslmode=disable"
GOTRUE_DB_NAMESPACE=auth
GOTRUE_SITE_URL=http://localhost:3000
GOTRUE_URI_ALLOW_LIST=http://localhost:3000/**
GOTRUE_JWT_SECRET=$SECRET
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMTP_HOST=127.0.0.1
GOTRUE_SMTP_PORT=2525
GOTRUE_SMTP_USER=x
GOTRUE_SMTP_PASS=x
GOTRUE_SMTP_ADMIN_EMAIL=no-reply@solveaneed.com
GOTRUE_SMTP_SENDER_NAME=SolveANeed
GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify
GOTRUE_PASSWORD_MIN_LENGTH=12
GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
GOTRUE_LOG_LEVEL=warn
GOTRUE_MAILER_TEMPLATES_CONFIRMATION=http://127.0.0.1:8099/confirmation.html
GOTRUE_MAILER_TEMPLATES_RECOVERY=http://127.0.0.1:8099/recovery.html
GOTRUE_MFA_TOTP_ENROLL_ENABLED=true
GOTRUE_MFA_TOTP_VERIFY_ENABLED=true
ENV
cat > "$E2E/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authpw@localhost:5432/solveaneed_e2e"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = 3001
db-pool = 10
CONF
echo "prepared $E2E"
