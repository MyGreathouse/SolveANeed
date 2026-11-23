-- =============================================================================
-- SolveANeed — Migration 2: Needs, evidence, saved needs, preferences,
-- reports, moderation, verification cases.
-- =============================================================================

create type public.need_status as enum
  ('draft', 'pending_review', 'changes_requested', 'published', 'rejected', 'closed', 'suspended');
create type public.need_visibility as enum ('public', 'members_only');
create type public.report_target as enum ('need', 'profile', 'message', 'offer');
create type public.report_reason as enum
  ('fraud_or_scam', 'misleading', 'inappropriate', 'harassment', 'duplicate', 'prohibited_request', 'other');
create type public.report_status as enum ('open', 'under_review', 'actioned', 'dismissed');
create type public.verification_type as enum ('identity', 'evidence', 'outcome');
create type public.verification_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Needs
-- Drafts may be incomplete; completeness is enforced by submit_need().
-- ---------------------------------------------------------------------------
create table public.needs (
  id                     uuid primary key default gen_random_uuid(),
  requester_id           uuid not null references public.profiles (id) on delete restrict,
  title                  text not null check (char_length(title) between 3 and 120),
  category_slug          text not null references public.need_categories (slug),
  description            text not null default '' check (char_length(description) <= 5000),
  amount_minor           bigint check (amount_minor is null or amount_minor > 0),
  currency               char(3) not null default 'GBP' references public.currencies (code),
  intended_use           text check (char_length(intended_use) <= 2000),
  region                 text check (char_length(region) <= 80),
  accepted_support_types public.support_type[] not null default '{gift}',
  deadline               date,
  visibility             public.need_visibility not null default 'public',
  show_requester_name    boolean not null default true,
  status                 public.need_status not null default 'draft',
  funded_minor           bigint not null default 0 check (funded_minor >= 0),
  funding_basis_points   integer generated always as (
                           case when amount_minor is null or amount_minor = 0 then 0
                                else least(10000, (funded_minor * 10000 / amount_minor))::integer end
                         ) stored,
  moderation_note        text,
  evidence_reviewed_at   timestamptz,
  outcome_confirmed_at   timestamptz,
  submitted_at           timestamptz,
  published_at           timestamptz,
  closed_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  search                 tsvector generated always as (
                           to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                         ) stored
);

create index needs_published_idx on public.needs (published_at desc) where status = 'published';
create index needs_requester_idx on public.needs (requester_id, updated_at desc);
create index needs_status_idx on public.needs (status, submitted_at);
create index needs_category_idx on public.needs (category_slug) where status = 'published';
create index needs_currency_amount_idx on public.needs (currency, amount_minor) where status = 'published';
create index needs_support_types_idx on public.needs using gin (accepted_support_types);
create index needs_search_idx on public.needs using gin (search);

create trigger needs_updated_at before update on public.needs
  for each row execute function public.set_updated_at();

-- Allowed status transitions (mirrors lib/domain/need-status.ts).
create or replace function public.need_transition_allowed(p_from public.need_status, p_to public.need_status)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (
    ('draft'::public.need_status,             'pending_review'::public.need_status),
    ('changes_requested',                     'pending_review'),
    ('changes_requested',                     'closed'),
    ('pending_review',                        'published'),
    ('pending_review',                        'changes_requested'),
    ('pending_review',                        'rejected'),
    ('published',                             'closed'),
    ('published',                             'suspended'),
    ('suspended',                             'published'),
    ('suspended',                             'closed')
  );
$$;

create or replace function public.needs_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.currencies where code = new.currency and enabled) then
      raise exception 'Currency % is not currently available', new.currency using errcode = '22023';
    end if;
    if new.status <> 'draft' then
      raise exception 'New needs must start as drafts' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.requester_id is distinct from old.requester_id then
    raise exception 'A need cannot change owner' using errcode = '42501';
  end if;

  if new.currency is distinct from old.currency
     and not exists (select 1 from public.currencies where code = new.currency and enabled) then
    raise exception 'Currency % is not currently available', new.currency using errcode = '22023';
  end if;

  if new.status is distinct from old.status
     and not public.need_transition_allowed(old.status, new.status) then
    raise exception 'Invalid need status transition % -> %', old.status, new.status using errcode = '22023';
  end if;

  -- Currency cannot change once money could be attached to the need.
  if new.currency is distinct from old.currency and old.status not in ('draft', 'changes_requested') then
    raise exception 'Currency cannot change after submission' using errcode = '22023';
  end if;

  -- Protected fields: only changeable inside privileged RPCs.
  -- current_user is the function owner inside SECURITY DEFINER RPCs.
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status
       or new.funded_minor is distinct from old.funded_minor
       or new.moderation_note is distinct from old.moderation_note
       or new.evidence_reviewed_at is distinct from old.evidence_reviewed_at
       or new.outcome_confirmed_at is distinct from old.outcome_confirmed_at
       or new.submitted_at is distinct from old.submitted_at
       or new.published_at is distinct from old.published_at
       or new.closed_at is distinct from old.closed_at then
      raise exception 'Protected need fields cannot be changed directly' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger needs_guard before insert or update on public.needs
  for each row execute function public.needs_guard();

-- ---------------------------------------------------------------------------
-- Evidence (private). Files live in the private 'need-evidence' bucket.
-- ---------------------------------------------------------------------------
create table public.need_evidence (
  id           uuid primary key default gen_random_uuid(),
  need_id      uuid not null references public.needs (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 200),
  mime_type    text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes   integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at   timestamptz not null default now(),
  check (storage_path like owner_id::text || '/' || need_id::text || '/%')
);
create index need_evidence_need_idx on public.need_evidence (need_id);

-- ---------------------------------------------------------------------------
-- Saved needs & support preferences
-- ---------------------------------------------------------------------------
create table public.saved_needs (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  need_id    uuid not null references public.needs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, need_id)
);

create table public.support_preferences (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,
  categories              text[] not null default '{}',
  support_types           public.support_type[] not null default '{}',
  regions                 text[] not null default '{}',
  currency                char(3) references public.currencies (code),
  max_amount_minor        bigint check (max_amount_minor is null or max_amount_minor > 0),
  open_to_paid_tasks      boolean not null default false,  -- requester opt-in to EARN offers
  updated_at              timestamptz not null default now(),
  check (max_amount_minor is null or currency is not null)
);
create trigger support_preferences_updated_at before update on public.support_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reports, moderation actions, verification cases
-- ---------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      public.report_reason not null,
  details     text check (char_length(details) <= 2000),
  status      public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution  text,
  created_at  timestamptz not null default now()
);
create index reports_open_idx on public.reports (created_at) where status in ('open', 'under_review');
create index reports_target_idx on public.reports (target_type, target_id);
create unique index reports_one_open_per_reporter
  on public.reports (reporter_id, target_type, target_id) where status in ('open', 'under_review');

create table public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles (id) on delete set null,
  target_type  text not null,
  target_id    uuid not null,
  action       text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id, created_at desc);
create trigger moderation_actions_append_only before update or delete on public.moderation_actions
  for each row execute function public.prevent_mutation();

create table public.verification_cases (
  id              uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references public.profiles (id) on delete cascade,
  need_id         uuid references public.needs (id) on delete cascade,
  type            public.verification_type not null,
  status          public.verification_status not null default 'pending',
  provider        text,           -- e.g. external identity provider (Phase 2+)
  provider_ref    text,
  reviewer_id     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  check (type = 'identity' or need_id is not null)
);
create index verification_cases_open_idx on public.verification_cases (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Public listing view (RLS of needs applies: security_invoker)
-- ---------------------------------------------------------------------------
create view public.needs_public with (security_invoker = true) as
  select n.id, n.title, n.category_slug, n.description, n.amount_minor, n.currency,
         n.intended_use, n.region, n.accepted_support_types, n.deadline, n.visibility,
         n.funded_minor, n.funding_basis_points, n.published_at,
         (n.evidence_reviewed_at is not null) as evidence_reviewed,
         (n.outcome_confirmed_at is not null) as outcome_confirmed,
         case when n.show_requester_name then pp.display_name else null end as requester_name,
         coalesce(pp.identity_verified, false) as requester_identity_verified,
         n.search
  from public.needs n
  left join public.public_profiles pp on pp.id = n.requester_id
  where n.status = 'published';

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.submit_need(p_need_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n public.needs%rowtype;
  c public.currencies%rowtype;
  v_dupes integer;
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
  if not public.check_rate_limit('submit_need', 5, 86400) then
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

  -- Duplicate check: same requester with an active need of the same title.
  select count(*) into v_dupes from public.needs
   where requester_id = n.requester_id and id <> n.id
     and status in ('pending_review', 'published')
     and lower(btrim(title)) = lower(btrim(n.title));
  if v_dupes > 0 then
    raise exception 'You already have an active need with this title' using errcode = '23505';
  end if;

  -- Cross-account duplicate description → risk signal for reviewers (not a block).
  insert into public.risk_signals (entity_type, entity_id, signal, detail)
  select 'need', n.id, 'duplicate_description', jsonb_build_object('matches', array_agg(o.id))
    from public.needs o
   where o.id <> n.id and o.requester_id <> n.requester_id
     and o.status in ('pending_review', 'published', 'suspended', 'rejected')
     and md5(lower(regexp_replace(o.description, '\s+', ' ', 'g')))
       = md5(lower(regexp_replace(n.description, '\s+', ' ', 'g')))
  having count(*) > 0;

  update public.needs set status = 'pending_review', submitted_at = now(), moderation_note = null
   where id = n.id;

  perform public.log_audit('need.submitted', 'need', n.id, '{}'::jsonb);
end $$;

create or replace function public.close_need(p_need_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n public.needs%rowtype;
begin
  select * into n from public.needs where id = p_need_id for update;
  if not found or n.requester_id <> auth.uid() then
    raise exception 'Need not found' using errcode = 'P0002';
  end if;
  if n.status <> 'published' then
    raise exception 'Only published needs can be closed' using errcode = '22023';
  end if;
  update public.needs set status = 'closed', closed_at = now() where id = n.id;
  perform public.log_audit('need.closed', 'need', n.id, '{}'::jsonb);
end $$;

-- p_action: approve | request_changes | reject | suspend | reinstate | mark_evidence_reviewed
create or replace function public.moderate_need(p_need_id uuid, p_action text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n public.needs%rowtype;
  v_to public.need_status;
  v_title text;
  v_body text;
begin
  if not public.is_staff() then
    raise exception 'Moderator role required' using errcode = '42501';
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
  if not public.check_rate_limit('submit_report', 10, 3600) then
    raise exception 'Too many reports. Please try again later.' using errcode = '54000';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(btrim(left(p_details, 2000)), ''))
  on conflict (reporter_id, target_type, target_id) where status in ('open', 'under_review') do nothing
  returning id into v_id;
  perform public.log_audit('report.submitted', p_target_type::text, p_target_id,
                           jsonb_build_object('reason', p_reason));
  return v_id;
end $$;

create or replace function public.resolve_report(p_report_id uuid, p_status public.report_status, p_resolution text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  if p_status not in ('under_review', 'actioned', 'dismissed') then
    raise exception 'Invalid report status' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status,
         resolution = nullif(btrim(p_resolution), ''),
         resolved_by = case when p_status in ('actioned', 'dismissed') then auth.uid() end,
         resolved_at = case when p_status in ('actioned', 'dismissed') then now() end
   where id = p_report_id;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, note)
  values (auth.uid(), 'report', p_report_id, 'report.' || p_status, nullif(btrim(p_resolution), ''));
  perform public.log_audit('report.resolved', 'report', p_report_id, jsonb_build_object('status', p_status));
end $$;

-- Account deletion request: anonymise, withdraw needs, flag for retention review.
create or replace function public.request_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  delete from public.needs where requester_id = v_uid and status = 'draft';
  update public.needs set status = 'closed', closed_at = now()
   where requester_id = v_uid and status in ('published', 'suspended', 'changes_requested');
  update public.needs set status = 'rejected', moderation_note = 'Withdrawn: account deletion requested'
   where requester_id = v_uid and status = 'pending_review';
  update public.profiles
     set account_status = 'deletion_requested', deletion_requested_at = now(),
         display_name = 'Deleted member', bio = null, region = null, show_region = false,
         notify_email_offers = false, notify_email_messages = false,
         notify_email_updates = false, notify_marketing = false
   where id = v_uid;
  delete from public.saved_needs where user_id = v_uid;
  delete from public.support_preferences where user_id = v_uid;
  perform public.log_audit('account.deletion_requested', 'profile', v_uid, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- RLS & grants
-- ---------------------------------------------------------------------------
alter table public.needs               enable row level security;
alter table public.need_evidence       enable row level security;
alter table public.saved_needs         enable row level security;
alter table public.support_preferences enable row level security;
alter table public.reports             enable row level security;
alter table public.moderation_actions  enable row level security;
alter table public.verification_cases  enable row level security;

revoke all on public.needs, public.need_evidence, public.saved_needs, public.support_preferences,
              public.reports, public.moderation_actions, public.verification_cases
  from anon, authenticated;

-- Needs
grant select on public.needs to anon, authenticated;
grant insert (requester_id, title, category_slug, description, amount_minor, currency, intended_use,
              region, accepted_support_types, deadline, visibility, show_requester_name)
  on public.needs to authenticated;
grant update (title, category_slug, description, amount_minor, currency, intended_use,
              region, accepted_support_types, deadline, visibility, show_requester_name)
  on public.needs to authenticated;
grant delete on public.needs to authenticated;

create policy needs_public_read on public.needs for select to anon
  using (status = 'published' and visibility = 'public');
create policy needs_member_read on public.needs for select to authenticated
  using (status = 'published' or requester_id = auth.uid() or public.is_staff());
create policy needs_insert_own on public.needs for insert to authenticated
  with check (requester_id = auth.uid() and public.is_active_user() and public.has_role('requester'));
create policy needs_update_own_editable on public.needs for update to authenticated
  using (requester_id = auth.uid() and status in ('draft', 'changes_requested'))
  with check (requester_id = auth.uid() and status in ('draft', 'changes_requested'));
create policy needs_delete_own_draft on public.needs for delete to authenticated
  using (requester_id = auth.uid() and status = 'draft');

grant select on public.needs_public to anon, authenticated;

-- Evidence: owner + staff only. Never public.
grant select, delete on public.need_evidence to authenticated;
grant insert (need_id, owner_id, storage_path, file_name, mime_type, size_bytes) on public.need_evidence to authenticated;
create policy evidence_select on public.need_evidence for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());
create policy evidence_insert on public.need_evidence for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.needs n where n.id = need_id and n.requester_id = auth.uid()
                and n.status in ('draft', 'changes_requested'))
    and (select count(*) from public.need_evidence e where e.need_id = need_evidence.need_id) < 10
  );
create policy evidence_delete on public.need_evidence for delete to authenticated
  using (
    owner_id = auth.uid()
    and exists (select 1 from public.needs n where n.id = need_id and n.status in ('draft', 'changes_requested'))
  );

-- Saved needs
grant select, insert, delete on public.saved_needs to authenticated;
create policy saved_select on public.saved_needs for select to authenticated using (user_id = auth.uid());
create policy saved_insert on public.saved_needs for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.needs n where n.id = need_id and n.status = 'published'));
create policy saved_delete on public.saved_needs for delete to authenticated using (user_id = auth.uid());

-- Support preferences
grant select, insert, update on public.support_preferences to authenticated;
create policy prefs_select on public.support_preferences for select to authenticated using (user_id = auth.uid());
create policy prefs_insert on public.support_preferences for insert to authenticated with check (user_id = auth.uid());
create policy prefs_update on public.support_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reports: submitted via RPC; reporters see their own; staff see all.
grant select on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());

-- Moderation actions & verification cases
grant select on public.moderation_actions to authenticated;
create policy moderation_staff_read on public.moderation_actions for select to authenticated
  using (public.is_staff());

grant select on public.verification_cases to authenticated;
create policy verification_select on public.verification_cases for select to authenticated
  using (subject_user_id = auth.uid() or public.is_staff());

-- Function privileges
revoke execute on function public.submit_need(uuid) from public, anon;
revoke execute on function public.close_need(uuid) from public, anon;
revoke execute on function public.moderate_need(uuid, text, text) from public, anon;
revoke execute on function public.submit_report(public.report_target, uuid, public.report_reason, text) from public, anon;
revoke execute on function public.resolve_report(uuid, public.report_status, text) from public, anon;
revoke execute on function public.request_account_deletion() from public, anon;
grant execute on function public.submit_need(uuid) to authenticated;
grant execute on function public.close_need(uuid) to authenticated;
grant execute on function public.moderate_need(uuid, text, text) to authenticated;
grant execute on function public.submit_report(public.report_target, uuid, public.report_reason, text) to authenticated;
grant execute on function public.resolve_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
