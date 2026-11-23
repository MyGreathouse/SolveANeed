-- =============================================================================
-- SolveANeed — Migration 6: Phase 2.5 security hardening
--
-- Fixes findings from the Phase 2.5 privilege audit (docs/SECURITY_AUDIT.md):
--  S1 CRITICAL  Views inherited Supabase default write grants; public_profiles
--               (owner-rights view) let anonymous users UPDATE/DELETE profiles.
--  S2 HIGH      public_profiles allowed anonymous enumeration of all members.
--  S3 HIGH      Staff could read any private evidence directly through Storage
--               (bypassing the audit log) and outside any review case.
--  S4 HIGH      Staff MFA was only checked in the web app, not in the database.
--  S5 MEDIUM    Moderators could suspend administrators / other moderators.
--  S6 MEDIUM    check_rate_limit() was callable with caller-chosen limits;
--               direct API writes (drafts, saves, uploads) were not limited.
--  S7 LOW       Reports accepted non-existent / own targets; report status
--               could move backwards; evidence could be "reviewed" on drafts.
--  S8 LOW       Trigger functions and future objects were executable/visible
--               by default (Supabase default privileges).
-- Adds: user blocking, sensitive-content detection, MFA audit trail,
--       platform settings, server-mediated anonymous rate limiting.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- S8: default privileges — new objects are NOT exposed unless granted.
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC on every new function by default; that
-- built-in default can only be removed globally (not per schema).
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_mutation() from public, anon, authenticated;
revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.needs_guard() from public, anon, authenticated;
revoke execute on function public.offers_guard() from public, anon, authenticated;
revoke execute on function public.agreements_terms_immutable() from public, anon, authenticated;
revoke execute on function public.contributions_currency_guard() from public, anon, authenticated;
revoke execute on function public.refunds_guard() from public, anon, authenticated;

-- Private schema: never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_secrets (
  name       text primary key,
  value_hash text not null,           -- sha256 hex of the secret; the secret itself is never stored
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Platform settings (non-secret, readable by members; admin-writable via RPC)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key        text primary key check (key ~ '^[a-z_]+$'),
  value      jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value) values
  ('require_staff_mfa', 'true'::jsonb),
  ('evidence_grant_seconds', '120'::jsonb);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;
create policy platform_settings_read on public.platform_settings for select to authenticated using (true);

create or replace function public.setting_bool(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.platform_settings where key = p_key), false);
$$;

-- Authenticator assurance level of the current request (aal1 = password only, aal2 = MFA).
create or replace function public.current_aal()
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1');
$$;

-- ---------------------------------------------------------------------------
-- S4: staff roles only count when MFA has been completed in this session.
-- Every RLS policy and RPC that uses has_role()/is_staff() inherits this.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = p_role and p.account_status = 'active'
  )
  and (
    p_role not in ('moderator', 'admin')
    or not public.setting_bool('require_staff_mfa')
    or public.current_aal() = 'aal2'
  );
$$;

-- Raw role membership regardless of MFA (used by the app to route staff to MFA).
create or replace function public.my_roles()
returns setof public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.user_roles where user_id = auth.uid();
$$;

create or replace function public.admin_set_platform_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then
    raise exception 'Administrator role (with MFA) required' using errcode = '42501';
  end if;
  update public.platform_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then
    raise exception 'Unknown setting %', p_key using errcode = '22023';
  end if;
  perform public.log_audit('settings.changed', 'platform_setting', null, jsonb_build_object('key', p_key, 'value', p_value));
end $$;

-- ---------------------------------------------------------------------------
-- S1 + S2: replace the owner-rights public_profiles view.
-- needs_public now gets the requester's public name through a function that
-- only answers for PUBLISHED needs, so members cannot be enumerated.
-- ---------------------------------------------------------------------------
drop view if exists public.needs_public;
drop view if exists public.public_profiles;

create or replace function public.need_requester_public(p_need_id uuid)
returns table (display_name text, identity_verified boolean)
language sql stable security definer set search_path = '' as $$
  select case when n.show_requester_name and p.account_status = 'active' then p.display_name end,
         (p.identity_verified_at is not null and p.account_status = 'active')
  from public.needs n
  join public.profiles p on p.id = n.requester_id
  where n.id = p_need_id
    and n.status = 'published'
    and (n.visibility = 'public' or auth.uid() is not null);
$$;

create view public.needs_public with (security_invoker = true) as
  select n.id, n.title, n.category_slug, n.description, n.amount_minor, n.currency,
         n.intended_use, n.region, n.accepted_support_types, n.deadline, n.visibility,
         n.funded_minor, n.funding_basis_points, n.published_at,
         (n.evidence_reviewed_at is not null) as evidence_reviewed,
         (n.outcome_confirmed_at is not null) as outcome_confirmed,
         r.display_name as requester_name,
         coalesce(r.identity_verified, false) as requester_identity_verified,
         n.search
  from public.needs n
  left join lateral public.need_requester_public(n.id) r on true
  where n.status = 'published';

revoke all on public.needs_public from public, anon, authenticated;
grant select on public.needs_public to anon, authenticated;
revoke execute on function public.need_requester_public(uuid) from public;
grant execute on function public.need_requester_public(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- S6: rate limiting driven by server-defined rules.
-- ---------------------------------------------------------------------------
create table public.rate_limit_rules (
  action         text primary key check (action ~ '^[a-z_]+$'),
  scope          text not null check (scope in ('user', 'anon')),
  max_hits       integer not null check (max_hits > 0),
  window_seconds integer not null check (window_seconds between 1 and 604800)
);
insert into public.rate_limit_rules (action, scope, max_hits, window_seconds) values
  ('submit_need',          'user', 5,   86400),
  ('create_need',          'user', 30,  86400),
  ('submit_report',        'user', 10,  3600),
  ('upload_evidence',      'user', 30,  3600),
  ('save_need',            'user', 200, 3600),
  ('update_profile',       'user', 60,  3600),
  ('set_role',             'user', 20,  3600),
  ('block_user',           'user', 30,  3600),
  ('sign_in_ip',           'anon', 20,  900),
  ('sign_in_email',        'anon', 8,   900),
  ('sign_up_ip',           'anon', 6,   3600),
  ('password_reset_email', 'anon', 3,   3600),
  ('password_reset_ip',    'anon', 10,  3600),
  ('mfa_verify_user',      'anon', 10,  900);
alter table public.rate_limit_rules enable row level security;
revoke all on public.rate_limit_rules from anon, authenticated;

-- Internal: record a hit against (key, action) using the rule's window.
create or replace function private.hit(p_key text, p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  r public.rate_limit_rules%rowtype;
  v_window timestamptz;
  v_hits integer;
begin
  select * into r from public.rate_limit_rules where action = p_action;
  if not found then
    raise exception 'Unknown rate-limit action %', p_action using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / r.window_seconds) * r.window_seconds);
  insert into public.rate_limits (key, window_start, hits)
  values (left(p_key, 200) || ':' || p_action, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= r.max_hits;
end $$;
revoke all on function private.hit(text, text) from public, anon, authenticated;

-- The old caller-parameterised function becomes internal only.
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Signed-in actions (key = user id).
create or replace function public.consume_rate_limit(p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rate_limit_rules where action = p_action and scope = 'user') then
    raise exception 'Unknown rate-limit action %', p_action using errcode = '22023';
  end if;
  return private.hit(auth.uid()::text, p_action);
end $$;
revoke execute on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

-- Signed-out actions mediated by the SolveANeed server (sign-in, sign-up,
-- password reset). Only callers holding the server token (env
-- RATE_LIMIT_SERVER_TOKEN, stored here as a sha256 hash) can consume buckets,
-- so third parties cannot exhaust someone else's allowance.
-- If no token hash is configured the limiter fails OPEN and returns NULL so
-- the app can log a configuration warning.
create or replace function public.consume_anon_rate_limit(p_action text, p_subject_hash text, p_server_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  if not exists (select 1 from public.rate_limit_rules where action = p_action and scope = 'anon') then
    raise exception 'Unknown rate-limit action %', p_action using errcode = '22023';
  end if;
  if p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Subject must be a sha256 hex digest' using errcode = '22023';
  end if;
  select value_hash into v_hash from private.app_secrets where name = 'rate_limit_server_token';
  if v_hash is null then
    return null;
  end if;
  if encode(sha256(convert_to(coalesce(p_server_token, ''), 'UTF8')), 'hex') <> v_hash then
    raise exception 'Invalid server token' using errcode = '42501';
  end if;
  return private.hit(p_subject_hash, p_action);
end $$;
revoke execute on function public.consume_anon_rate_limit(text, text, text) from public;
grant execute on function public.consume_anon_rate_limit(text, text, text) to anon, authenticated;

-- Database-enforced limits on direct Data API writes (cannot be bypassed by
-- calling the API without going through the web app).
create or replace function public.enforce_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Keyed on the signed-in user; applies to direct API writes and RPC writes alike.
  if auth.uid() is not null and not private.hit(auth.uid()::text, tg_argv[0]) then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

create trigger needs_rate_limit before insert on public.needs
  for each row execute function public.enforce_rate_limit('create_need');
create trigger saved_needs_rate_limit before insert on public.saved_needs
  for each row execute function public.enforce_rate_limit('save_need');
create trigger need_evidence_rate_limit before insert on public.need_evidence
  for each row execute function public.enforce_rate_limit('upload_evidence');
create trigger profiles_rate_limit before update on public.profiles
  for each row when (old.display_name is distinct from new.display_name or old.bio is distinct from new.bio)
  execute function public.enforce_rate_limit('update_profile');

-- ---------------------------------------------------------------------------
-- S3: staff evidence access only within an active review case, through a
-- short-lived, audit-logged grant. Storage reads by staff require the grant.
-- ---------------------------------------------------------------------------
create or replace function public.staff_evidence_in_scope(p_need_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() and exists (
    select 1 from public.needs n
    where n.id = p_need_id
      and (
        n.status = 'pending_review'
        or exists (select 1 from public.reports r where r.target_type = 'need' and r.target_id = n.id
                   and r.status in ('open', 'under_review'))
        or exists (select 1 from public.verification_cases v where v.need_id = n.id and v.status = 'pending')
      )
  );
$$;
revoke execute on function public.staff_evidence_in_scope(uuid) from public, anon;
grant execute on function public.staff_evidence_in_scope(uuid) to authenticated;

create table public.evidence_access_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  evidence_id  uuid not null references public.need_evidence (id) on delete cascade,
  storage_path text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index evidence_access_grants_lookup on public.evidence_access_grants (user_id, storage_path, expires_at);
alter table public.evidence_access_grants enable row level security;
revoke all on public.evidence_access_grants from anon, authenticated;

create or replace function public.staff_has_evidence_grant(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.evidence_access_grants g
                 where g.user_id = auth.uid() and g.storage_path = p_path and g.expires_at > now());
$$;
revoke execute on function public.staff_has_evidence_grant(text) from public, anon;
grant execute on function public.staff_has_evidence_grant(text) to authenticated;

create or replace function public.authorise_evidence_access(p_evidence_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.need_evidence%rowtype;
  v_seconds integer;
begin
  if auth.uid() is null then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into e from public.need_evidence where id = p_evidence_id;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if e.owner_id = auth.uid() then
    return e.storage_path;
  end if;
  if public.staff_evidence_in_scope(e.need_id) then
    v_seconds := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'evidence_grant_seconds'), 120);
    insert into public.evidence_access_grants (user_id, evidence_id, storage_path, expires_at)
    values (auth.uid(), e.id, e.storage_path, now() + make_interval(secs => v_seconds));
    perform public.log_audit('evidence.viewed', 'need', e.need_id,
                             jsonb_build_object('evidence_id', e.id, 'owner_id', e.owner_id));
    return e.storage_path;
  end if;
  raise exception 'Not found' using errcode = 'P0002';
end $$;

drop policy evidence_select on public.need_evidence;
create policy evidence_select on public.need_evidence for select to authenticated
  using (owner_id = auth.uid() or public.staff_evidence_in_scope(need_id));

drop policy "need-evidence: owner or staff can read" on storage.objects;
create policy "need-evidence: owner, or staff with an active grant"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'need-evidence'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.staff_has_evidence_grant(name))
  );

-- ---------------------------------------------------------------------------
-- S5: only administrators may change the status of staff accounts.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff role (with MFA) required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Status must be active or suspended' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user_id and role in ('moderator', 'admin'))
     and not public.has_role('admin') then
    raise exception 'Only an administrator can change a staff account' using errcode = '42501';
  end if;
  if (select account_status from public.profiles where id = p_user_id) = 'deletion_requested' then
    raise exception 'This account is being deleted' using errcode = '22023';
  end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  perform public.log_audit('account.status_changed', 'profile', p_user_id,
                           jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Sensitive-content and off-platform-payment detection (signals for review).
-- ---------------------------------------------------------------------------
create or replace function public.detect_sensitive_content(p_text text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(label order by label), '{}')
  from (values
    ('bank_sort_code',      '\m\d{2}[- ]\d{2}[- ]\d{2}\M'),
    ('bank_account_number', '(account|acct|a/c)\s*(no\.?|number|#)?\s*[:\-]?\s*\d{8,10}'),
    ('iban',                '\m[A-Z]{2}\d{2}\s?[A-Z]{4}\s?[0-9]{4}\s?[0-9]{4}'),
    ('card_number',         '\m\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\M'),
    ('email_address',       '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'),
    ('phone_number',        '(\+44\s?7\d{3}|\m07\d{3})\s?\d{3}\s?\d{3}|\+234\s?\d{3}\s?\d{3}\s?\d{4}'),
    ('off_platform_payment','paypal|cash ?app|revolut|western union|moneygram|bank transfer|transfer (it )?(to me )?directly|pay (me )?(directly|direct|outside)|gift ?cards?|bitcoin|crypto|usdt'),
    ('off_platform_contact','whats ?app|telegram|signal app|snapchat|dm me|text me|call me'),
    ('sensitive_identifier','passport (no|number)|national insurance|\mni number|\mbvn\M|\mnin\M|password|pin (code|number)')
  ) as p(label, pattern)
  where p_text ~* pattern;
$$;
revoke execute on function public.detect_sensitive_content(text) from public, anon;
grant execute on function public.detect_sensitive_content(text) to authenticated;

-- ---------------------------------------------------------------------------
-- User blocking (enforced by Phase 3 offer/message RPCs via is_blocked_between)
-- ---------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  reason     text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;
create policy user_blocks_select on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid() or public.is_staff());

create or replace function public.block_user(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot block yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if not private.hit(auth.uid()::text, 'block_user') then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id, reason)
  values (auth.uid(), p_user_id, nullif(btrim(left(p_reason, 500)), ''))
  on conflict do nothing;
  perform public.log_audit('user.blocked', 'profile', p_user_id, '{}'::jsonb);
end $$;

create or replace function public.unblock_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
  perform public.log_audit('user.unblocked', 'profile', p_user_id, '{}'::jsonb);
end $$;

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks
                 where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a));
$$;

-- Blocked members are listed to the blocker by display name only.
create or replace function public.my_blocked_users()
returns table (user_id uuid, display_name text, reason text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, p.display_name, b.reason, b.created_at
  from public.user_blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke execute on function public.block_user(uuid, text) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.my_blocked_users() from public, anon;
grant execute on function public.block_user(uuid, text) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocked_users() to authenticated;

-- ---------------------------------------------------------------------------
-- S7: tighten submit_need / moderate_need / submit_report / resolve_report.
-- ---------------------------------------------------------------------------
create or replace function public.submit_need(p_need_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n public.needs%rowtype;
  c public.currencies%rowtype;
  v_dupes integer;
  v_flags text[];
begin
  if auth.uid() is null or not public.is_active_user() or not public.has_role('requester') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into n from public.needs where id = p_need_id for update;
  if not found or n.requester_id <> auth.uid() then
    raise exception 'Need not found' using errcode = 'P0002';
  end if;
  if n.status not in ('draft', 'changes_requested') then
    raise exception 'Only drafts can be submitted' using errcode = '22023';
  end if;
  if not private.hit(auth.uid()::text, 'submit_need') then
    raise exception 'Too many submissions today. Please try again tomorrow.' using errcode = '54000';
  end if;

  select * into c from public.currencies where code = n.currency;
  if not c.enabled then
    raise exception 'Currency % is not currently available', n.currency using errcode = '22023';
  end if;
  if char_length(btrim(n.title)) < 10 then
    raise exception 'Title must be at least 10 characters' using errcode = '22023';
  end if;
  if char_length(btrim(n.description)) < 80 then
    raise exception 'Description must be at least 80 characters' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(n.intended_use, ''))) < 20 then
    raise exception 'Please explain how the support will be used (20+ characters)' using errcode = '22023';
  end if;
  if n.amount_minor is null or n.amount_minor < c.min_need_minor or n.amount_minor > c.max_need_minor then
    raise exception 'Requested amount is outside the allowed range for %', n.currency using errcode = '22023';
  end if;
  if cardinality(n.accepted_support_types) = 0 then
    raise exception 'Choose at least one accepted support type' using errcode = '22023';
  end if;
  if n.deadline is not null and n.deadline <= current_date then
    raise exception 'Deadline must be in the future' using errcode = '22023';
  end if;
  if not exists (select 1 from public.need_categories where slug = n.category_slug and active) then
    raise exception 'Category is not available' using errcode = '22023';
  end if;

  select count(*) into v_dupes from public.needs
   where requester_id = n.requester_id and id <> n.id
     and status in ('pending_review', 'published')
     and lower(btrim(title)) = lower(btrim(n.title));
  if v_dupes > 0 then
    raise exception 'You already have an active need with this title' using errcode = '23505';
  end if;

  insert into public.risk_signals (entity_type, entity_id, signal, detail)
  select 'need', n.id, 'duplicate_description', jsonb_build_object('matches', array_agg(o.id))
    from public.needs o
   where o.id <> n.id and o.requester_id <> n.requester_id
     and o.status in ('pending_review', 'published', 'suspended', 'rejected')
     and md5(lower(regexp_replace(o.description, '\s+', ' ', 'g')))
       = md5(lower(regexp_replace(n.description, '\s+', ' ', 'g')))
  having count(*) > 0;

  v_flags := public.detect_sensitive_content(concat_ws(' ', n.title, n.description, n.intended_use));
  if cardinality(v_flags) > 0 then
    insert into public.risk_signals (entity_type, entity_id, signal, detail)
    values ('need', n.id, 'sensitive_content', jsonb_build_object('categories', v_flags));
  end if;

  update public.needs set status = 'pending_review', submitted_at = now(), moderation_note = null where id = n.id;
  perform public.log_audit('need.submitted', 'need', n.id, '{}'::jsonb);
end $$;

create or replace function public.moderate_need(p_need_id uuid, p_action text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n public.needs%rowtype;
  v_to public.need_status;
  v_title text;
  v_body text;
begin
  if not public.is_staff() then
    raise exception 'Moderator role (with MFA) required' using errcode = '42501';
  end if;
  select * into n from public.needs where id = p_need_id for update;
  if not found then
    raise exception 'Need not found' using errcode = 'P0002';
  end if;
  if n.requester_id = auth.uid() then
    raise exception 'You cannot moderate your own need' using errcode = '42501';
  end if;
  if p_action in ('request_changes', 'reject', 'suspend') and coalesce(btrim(p_note), '') = '' then
    raise exception 'A note explaining the decision is required' using errcode = '22023';
  end if;

  if p_action = 'mark_evidence_reviewed' then
    if n.status <> 'pending_review' then
      raise exception 'Evidence can only be marked reviewed during review' using errcode = '22023';
    end if;
    update public.needs set evidence_reviewed_at = now() where id = n.id;
    v_title := 'Evidence reviewed';
    v_body := 'A moderator has reviewed the evidence for "' || n.title || '".';
  else
    v_to := case p_action
              when 'approve' then 'published'
              when 'request_changes' then 'changes_requested'
              when 'reject' then 'rejected'
              when 'suspend' then 'suspended'
              when 'reinstate' then 'published'
              else null end;
    if v_to is null then
      raise exception 'Unknown moderation action %', p_action using errcode = '22023';
    end if;
    if p_action = 'reinstate' and n.status <> 'suspended' then
      raise exception 'Only suspended needs can be reinstated' using errcode = '22023';
    end if;
    update public.needs
       set status = v_to,
           moderation_note = nullif(btrim(p_note), ''),
           published_at = case when v_to = 'published' and published_at is null then now() else published_at end
     where id = n.id;
    v_title := case p_action
                 when 'approve' then 'Your need is live'
                 when 'request_changes' then 'Changes requested'
                 when 'reject' then 'Your need was not approved'
                 when 'suspend' then 'Your need has been suspended'
                 else 'Your need has been reinstated' end;
    v_body := '"' || n.title || '"' || coalesce(' — ' || nullif(btrim(p_note), ''), '');
  end if;

  insert into public.moderation_actions (moderator_id, target_type, target_id, action, note)
  values (auth.uid(), 'need', n.id, p_action, nullif(btrim(p_note), ''));
  perform public.notify_user(n.requester_id, 'need.' || p_action, v_title, v_body,
                             '/dashboard/requester/needs/' || n.id);
  perform public.log_audit('need.moderated', 'need', n.id,
                           jsonb_build_object('action', p_action, 'from', n.status));
end $$;

create or replace function public.submit_report(
  p_target_type public.report_target, p_target_id uuid, p_reason public.report_reason, p_details text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Please sign in to report content' using errcode = '42501';
  end if;
  if p_target_type = 'need' then
    if not exists (select 1 from public.needs where id = p_target_id and status in ('published', 'suspended')) then
      raise exception 'That need could not be found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.needs where id = p_target_id and requester_id = auth.uid()) then
      raise exception 'You cannot report your own need' using errcode = '22023';
    end if;
  elsif p_target_type = 'profile' then
    if p_target_id = auth.uid() or not exists (select 1 from public.profiles where id = p_target_id) then
      raise exception 'That member could not be found' using errcode = 'P0002';
    end if;
  else
    -- message / offer reports arrive with Phase 3; their targets are validated there.
    raise exception 'Reports on % are not available yet', p_target_type using errcode = '22023';
  end if;
  if not private.hit(auth.uid()::text, 'submit_report') then
    raise exception 'Too many reports. Please try again later.' using errcode = '54000';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(btrim(left(p_details, 2000)), ''))
  on conflict (reporter_id, target_type, target_id) where status in ('open', 'under_review') do nothing
  returning id into v_id;
  perform public.log_audit('report.submitted', p_target_type::text, p_target_id, jsonb_build_object('reason', p_reason));
  return v_id;
end $$;

create or replace function public.resolve_report(p_report_id uuid, p_status public.report_status, p_resolution text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Moderator role (with MFA) required' using errcode = '42501';
  end if;
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if r.reporter_id = auth.uid() then
    raise exception 'You cannot resolve your own report' using errcode = '42501';
  end if;
  if not ((r.status = 'open' and p_status in ('under_review', 'actioned', 'dismissed'))
       or (r.status = 'under_review' and p_status in ('actioned', 'dismissed'))) then
    raise exception 'Invalid report status change' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status,
         resolution = nullif(btrim(p_resolution), ''),
         resolved_by = case when p_status in ('actioned', 'dismissed') then auth.uid() end,
         resolved_at = case when p_status in ('actioned', 'dismissed') then now() end
   where id = p_report_id;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, note)
  values (auth.uid(), 'report', p_report_id, 'report.' || p_status, nullif(btrim(p_resolution), ''));
  perform public.log_audit('report.resolved', 'report', p_report_id, jsonb_build_object('status', p_status));
end $$;

-- ---------------------------------------------------------------------------
-- MFA recovery: manual factor resets (done by an admin in the Supabase
-- dashboard) must be recorded here with a reason.
-- ---------------------------------------------------------------------------
create or replace function public.record_staff_mfa_reset(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then
    raise exception 'Administrator role (with MFA) required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Another administrator must record your MFA reset' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  perform public.log_audit('mfa.reset_recorded', 'profile', p_user_id, jsonb_build_object('reason', p_reason));
end $$;
revoke execute on function public.record_staff_mfa_reset(uuid, text) from public, anon;
grant execute on function public.record_staff_mfa_reset(uuid, text) to authenticated;

-- Audit trail of MFA factor changes made through Supabase Auth.
create or replace function public.audit_mfa_factor_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  select p.id,
         case tg_op when 'INSERT' then 'mfa.factor_enrolled' when 'DELETE' then 'mfa.factor_removed' else 'mfa.factor_updated' end,
         'profile', p.id,
         jsonb_build_object('factor_type', coalesce(new.factor_type, old.factor_type)::text,
                            'status', coalesce(new.status, old.status)::text)
  from public.profiles p where p.id = coalesce(new.user_id, old.user_id);
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_mfa_factor_change() from public, anon, authenticated;

do $$
begin
  if to_regclass('auth.mfa_factors') is not null then
    execute 'create trigger solveaneed_audit_mfa after insert or delete or update of status on auth.mfa_factors
             for each row execute function public.audit_mfa_factor_change()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges for new/changed functions
-- ---------------------------------------------------------------------------
revoke execute on function public.setting_bool(text) from public;
grant execute on function public.setting_bool(text) to anon, authenticated;
revoke execute on function public.current_aal() from public;
grant execute on function public.current_aal() to anon, authenticated;
revoke execute on function public.my_roles() from public, anon;
grant execute on function public.my_roles() to authenticated;
revoke execute on function public.admin_set_platform_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_platform_setting(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- S9 (LOW): staff could read members' unsubmitted drafts. Drafts are now
-- private to their owner; staff see needs from submission onwards.
-- ---------------------------------------------------------------------------
drop policy needs_member_read on public.needs;
create policy needs_member_read on public.needs for select to authenticated
  using (status = 'published' or requester_id = auth.uid() or (public.is_staff() and status <> 'draft'));
