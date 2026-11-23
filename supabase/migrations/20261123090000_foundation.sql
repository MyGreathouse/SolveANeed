-- =============================================================================
-- SolveANeed — Migration 1: Foundation
-- Currencies (multi-currency, integer minor units), categories, profiles,
-- roles, audit log, rate limiting, risk signals, notifications.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('requester', 'supporter', 'business_rep', 'moderator', 'admin');
create type public.account_status as enum ('active', 'suspended', 'deletion_requested');
create type public.support_type as enum ('gift', 'paid_task', 'milestone', 'direct_support');

-- ---------------------------------------------------------------------------
-- Currencies — every money column in SolveANeed is (amount_minor bigint, currency char(3)).
-- minor_unit = ISO 4217 exponent (GBP 2 → pence, JPY 0, KWD 3).
-- Amounts in different currencies are NEVER summed together.
-- ---------------------------------------------------------------------------
create table public.currencies (
  code            char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name            text not null,
  symbol          text not null,
  minor_unit      smallint not null check (minor_unit between 0 and 4),
  enabled         boolean not null default false,
  min_need_minor  bigint not null check (min_need_minor > 0),
  max_need_minor  bigint not null,
  sort_order      smallint not null default 100,
  created_at      timestamptz not null default now(),
  check (max_need_minor > min_need_minor)
);

comment on table public.currencies is
  'ISO 4217 currencies. enabled = may be chosen for new needs. Provider support for each currency must be confirmed before Phase 4 (payments).';

insert into public.currencies (code, name, symbol, minor_unit, enabled, min_need_minor, max_need_minor, sort_order) values
  ('GBP', 'British pound',      '£',   2, true,  1000,        2500000,     1),
  ('EUR', 'Euro',               '€',   2, true,  1000,        3000000,     2),
  ('USD', 'US dollar',          '$',   2, true,  1000,        3000000,     3),
  ('NGN', 'Nigerian naira',     '₦',   2, true,  1000000,     5000000000,  4),
  ('CAD', 'Canadian dollar',    'CA$', 2, false, 1500,        4000000,     5),
  ('AUD', 'Australian dollar',  'A$',  2, false, 1500,        4500000,     6),
  ('JPY', 'Japanese yen',       '¥',   0, false, 2000,        5000000,     7),
  ('KWD', 'Kuwaiti dinar',      'KD',  3, false, 4000,        8000000,     8);

-- ---------------------------------------------------------------------------
-- Need categories (reference data)
-- ---------------------------------------------------------------------------
create table public.need_categories (
  slug        text primary key check (slug ~ '^[a-z0-9-]+$'),
  label       text not null,
  description text not null,
  active      boolean not null default true,
  sort_order  smallint not null default 100
);

insert into public.need_categories (slug, label, description, sort_order) values
  ('education',           'Education',            'Course fees, learning materials and qualifications.', 1),
  ('employment',          'Employment',           'Getting into work or staying in work.',                2),
  ('skills-training',     'Skills and Training',  'Professional and vocational training.',               3),
  ('small-business',      'Small Business',       'Starting or growing a small business.',               4),
  ('essential-equipment', 'Essential Equipment',  'Tools, devices and equipment needed for work or study.', 5),
  ('community-projects',  'Community Projects',   'Projects that benefit a local community.',            6),
  ('other',               'Other Approved Needs', 'Other genuine needs approved by our moderators.',     7);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text not null check (char_length(display_name) between 2 and 60),
  bio                   text check (char_length(bio) <= 1000),
  region                text check (char_length(region) <= 80),
  preferred_currency    char(3) not null default 'GBP' references public.currencies (code),
  show_region           boolean not null default true,
  notify_email_offers   boolean not null default true,
  notify_email_messages boolean not null default true,
  notify_email_updates  boolean not null default true,
  notify_marketing      boolean not null default false,
  age_confirmed_at      timestamptz not null,   -- 18+ self-attestation at sign-up (NOT identity verification)
  terms_accepted_at     timestamptz not null,
  account_status        public.account_status not null default 'active',
  identity_verified_at  timestamptz,            -- set only by staff via verification workflow
  deletion_requested_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles (role);

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role checks only ever look at the CURRENT user, so they cannot be used to
-- probe other accounts' roles.
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = p_role and p.account_status = 'active'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('moderator') or public.has_role('admin');
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active');
$$;

-- ---------------------------------------------------------------------------
-- Audit log — append-only. Written only through public.log_audit().
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at desc);
create index audit_events_created_idx on public.audit_events (created_at desc);

create or replace function public.prevent_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Table % is append-only', tg_table_name using errcode = '42501';
end $$;

create trigger audit_events_append_only before update or delete on public.audit_events
  for each row execute function public.prevent_mutation();

create or replace function public.log_audit(
  p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (durable across serverless instances)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

-- Returns true if the action is allowed (and records the hit), false if over the limit.
create or replace function public.check_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_hits integer;
begin
  if v_uid is null then
    return false;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (key, window_start, hits)
  values (v_uid::text || ':' || p_action, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

create or replace function public.purge_rate_limits()
returns void language sql security definer set search_path = '' as $$
  delete from public.rate_limits where window_start < now() - interval '2 days';
$$;

-- ---------------------------------------------------------------------------
-- Risk signals — staff-only fraud/duplicate indicators. Assist reviewers;
-- they never make decisions on their own.
-- ---------------------------------------------------------------------------
create table public.risk_signals (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id   uuid not null,
  signal      text not null,
  detail      jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index risk_signals_entity_idx on public.risk_signals (entity_type, entity_id);
create index risk_signals_open_idx on public.risk_signals (created_at desc) where reviewed_at is null;

-- ---------------------------------------------------------------------------
-- Notifications (in-app)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link_path  text check (link_path is null or link_path ~ '^/[^/]'),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify_user(
  p_user_id uuid, p_type text, p_title text, p_body text, p_link text
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link_path)
  values (p_user_id, p_type, p_title, p_body, p_link);
$$;

-- ---------------------------------------------------------------------------
-- New-user trigger: creates profile + self-selected roles.
-- Enforces the 18+ attestation and terms acceptance server-side.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := btrim(coalesce(v_meta ->> 'display_name', ''));
  v_intent text := coalesce(v_meta ->> 'intent', 'both');
begin
  if coalesce(v_meta ->> 'age_confirmed', 'false') <> 'true' then
    raise exception 'SolveANeed accounts are for adults aged 18 and over' using errcode = '22023';
  end if;
  if coalesce(v_meta ->> 'terms_accepted', 'false') <> 'true' then
    raise exception 'Terms must be accepted' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 then
    v_name := 'Member';
  end if;

  insert into public.profiles (id, display_name, age_confirmed_at, terms_accepted_at)
  values (new.id, left(v_name, 60), now(), now());

  if v_intent in ('need', 'both') then
    insert into public.user_roles (user_id, role) values (new.id, 'requester');
  end if;
  if v_intent in ('help', 'both') then
    insert into public.user_roles (user_id, role) values (new.id, 'supporter');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard: users may only change their own self-service profile columns.
-- (Column grants below are the primary control; this trigger is defence in depth.)
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Inside SECURITY DEFINER functions current_user is the function owner, so
  -- only direct client writes (anon/authenticated) are restricted here.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.account_status is distinct from old.account_status
     or new.identity_verified_at is distinct from old.identity_verified_at
     or new.age_confirmed_at is distinct from old.age_confirmed_at
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.deletion_requested_at is distinct from old.deletion_requested_at then
    raise exception 'Protected profile fields cannot be changed directly' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------------
-- Public projection of profiles (safe columns only, active accounts only).
-- ---------------------------------------------------------------------------
create view public.public_profiles as
  select p.id,
         p.display_name,
         case when p.show_region then p.region end as region,
         (p.identity_verified_at is not null) as identity_verified,
         p.created_at
  from public.profiles p
  where p.account_status = 'active';

-- ---------------------------------------------------------------------------
-- Self-service role management (requester / supporter only).
-- ---------------------------------------------------------------------------
create or replace function public.set_my_role(p_role public.app_role, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_role not in ('requester', 'supporter') then
    raise exception 'This role can only be granted by an administrator' using errcode = '42501';
  end if;
  if p_enabled then
    insert into public.user_roles (user_id, role) values (auth.uid(), p_role) on conflict do nothing;
  else
    delete from public.user_roles where user_id = auth.uid() and role = p_role;
  end if;
  perform public.log_audit('role.self_' || case when p_enabled then 'added' else 'removed' end,
                           'profile', auth.uid(), jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and p_role = 'admin' and not p_enabled then
    raise exception 'Administrators cannot remove their own admin role' using errcode = '42501';
  end if;
  if p_enabled then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, auth.uid())
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform public.log_audit('role.' || case when p_enabled then 'granted' else 'revoked' end,
                           'profile', p_user_id, jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff role required' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  perform public.log_audit('account.status_changed', 'profile', p_user_id,
                           jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security & grants
-- ---------------------------------------------------------------------------
alter table public.currencies      enable row level security;
alter table public.need_categories enable row level security;
alter table public.profiles        enable row level security;
alter table public.user_roles      enable row level security;
alter table public.audit_events    enable row level security;
alter table public.rate_limits     enable row level security;
alter table public.risk_signals    enable row level security;
alter table public.notifications   enable row level security;

revoke all on public.currencies, public.need_categories, public.profiles, public.user_roles,
              public.audit_events, public.rate_limits, public.risk_signals, public.notifications
  from anon, authenticated;

-- Reference data: readable by everyone
grant select on public.currencies, public.need_categories to anon, authenticated;
create policy currencies_read on public.currencies for select using (true);
create policy categories_read on public.need_categories for select using (true);

-- Profiles
grant select on public.profiles to authenticated;
grant update (display_name, bio, region, preferred_currency, show_region,
              notify_email_offers, notify_email_messages, notify_email_updates, notify_marketing)
  on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.public_profiles to anon, authenticated;

-- Roles: read own (staff read all). All writes via set_my_role / admin_set_role.
grant select on public.user_roles to authenticated;
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Audit: administrators only
grant select on public.audit_events to authenticated;
create policy audit_admin_read on public.audit_events for select to authenticated
  using (public.has_role('admin'));

-- Risk signals: staff only
grant select on public.risk_signals to authenticated;
create policy risk_staff_read on public.risk_signals for select to authenticated
  using (public.is_staff());

-- Notifications: own only; may only mark as read
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Function execute privileges
revoke execute on function public.log_audit(text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.purge_rate_limits() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon;
revoke execute on function public.set_my_role(public.app_role, boolean) from public, anon;
revoke execute on function public.admin_set_role(uuid, public.app_role, boolean) from public, anon;
revoke execute on function public.admin_set_account_status(uuid, public.account_status, text) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
grant execute on function public.set_my_role(public.app_role, boolean) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role, boolean) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.has_role(public.app_role) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_active_user() to anon, authenticated;
