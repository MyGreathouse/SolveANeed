-- =============================================================================
-- SolveANeed — Phase 3 (2/2): offer marketplace, agreements, paid tasks,
-- messaging, safety and durable notifications.
--
-- Principles (unchanged from Phase 2.5):
--   * Clients never write these tables directly. Every change goes through a
--     SECURITY DEFINER function with search_path = '', which checks the caller,
--     the state machine, blocks and rate limits, then writes an append-only
--     event and an audit record.
--   * No money moves. An agreement is "funded" only when a provider-confirmed
--     live payment exists, which the database still forbids (livemode = false).
--   * Paid-task work can start without payment only when the platform setting
--     sandbox_workflows is on (test/staging). Such agreements are permanently
--     marked test_mode = true.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Settings and rate-limit rules
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value) values
  ('sandbox_workflows', 'false'::jsonb),     -- test/staging only: lets paid-task workflows run with no payment
  ('offer_expiry_days', '14'::jsonb),
  ('task_dispute_window_hours', '168'::jsonb)
on conflict (key) do nothing;

insert into public.rate_limit_rules (action, scope, max_hits, window_seconds) values
  ('create_offer',      'user', 20,  86400),
  ('offer_response',    'user', 120, 3600),
  ('agreement_action',  'user', 120, 3600),
  ('send_message',      'user', 120, 3600),
  ('upload_attachment', 'user', 30,  3600),
  ('open_dispute',      'user', 5,   86400)
on conflict (action) do nothing;

-- ---------------------------------------------------------------------------
-- Non-cash direct support (time, expertise) carries no amount.
-- ---------------------------------------------------------------------------
alter table public.offers drop constraint offers_amount_minor_check;
alter table public.offers add constraint offers_amount_check
  check (amount_minor >= 0 and (amount_minor > 0 or offer_type = 'direct_support'));
alter table public.offer_versions drop constraint offer_versions_amount_minor_check;
alter table public.offer_versions add constraint offer_versions_amount_check check (amount_minor >= 0);
alter table public.agreements drop constraint agreements_amount_minor_check;
alter table public.agreements add constraint agreements_amount_check
  check (amount_minor >= 0 and (amount_minor > 0 or agreement_type = 'direct_support'));

alter table public.offers
  add column last_proposed_by uuid references public.profiles (id) on delete restrict,
  add column closed_reason    text check (char_length(closed_reason) <= 1000),
  add column closed_at        timestamptz;

alter table public.agreements
  add column need_id              uuid references public.needs (id) on delete restrict,
  add column test_mode            boolean not null default false,
  add column payment_ready_at     timestamptz,
  add column max_revisions        smallint not null default 0 check (max_revisions between 0 and 5),
  add column revisions_used       smallint not null default 0 check (revisions_used >= 0),
  add column dispute_window_hours integer not null default 168 check (dispute_window_hours between 24 and 720),
  add column work_started_at      timestamptz,
  add column submitted_at         timestamptz,
  add column completed_at         timestamptz,
  add column cancelled_at         timestamptz,
  add constraint agreements_revisions_within_limit check (revisions_used <= max_revisions);

alter table public.disputes
  add column assigned_to uuid references public.profiles (id) on delete set null,
  add column outcome     text check (outcome in ('complete', 'cancel'));

-- ---------------------------------------------------------------------------
-- Agreement state machine (mirrors lib/domain/agreement-status.ts)
-- ---------------------------------------------------------------------------
create or replace function public.agreement_transition_allowed(p_from public.agreement_status, p_to public.agreement_status)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  return (p_from::text, p_to::text) in (
    ('awaiting_payment_readiness', 'active'),
    ('awaiting_payment_readiness', 'cancelled'),
    ('awaiting_payment_readiness', 'lapsed'),
    ('active',                     'submitted'),
    ('active',                     'completed'),   -- non-cash direct support confirmed by the requester
    ('active',                     'cancelled'),
    ('active',                     'disputed'),
    ('submitted',                  'completed'),
    ('submitted',                  'revision_requested'),
    ('submitted',                  'disputed'),
    ('revision_requested',         'submitted'),
    ('revision_requested',         'cancelled'),
    ('revision_requested',         'disputed'),
    ('disputed',                   'completed'),
    ('disputed',                   'cancelled')
  );
end $$;

create or replace function public.agreements_status_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status
     and not public.agreement_transition_allowed(old.status, new.status) then
    raise exception 'Invalid agreement status transition % -> %', old.status, new.status using errcode = '22023';
  end if;
  if new.test_mode is distinct from old.test_mode and old.test_mode then
    raise exception 'A test-mode agreement cannot be relabelled' using errcode = '42501';
  end if;
  if new.agreement_type is distinct from old.agreement_type or new.requester_id is distinct from old.requester_id
     or new.supporter_id is distinct from old.supporter_id or new.max_revisions is distinct from old.max_revisions then
    raise exception 'Agreement terms are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger agreements_status_guard before update on public.agreements
  for each row execute function public.agreements_status_guard();

-- Funding is only ever reported from a provider-confirmed LIVE payment.
-- payment_transactions.livemode is constrained to false, so today every
-- agreement reports 'not_funded'. Phase 4 changes this only with approval.
create or replace function public.agreement_funding_status(p_agreement_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when exists (
    select 1 from public.payment_transactions t
    join public.agreements a on a.id = t.agreement_id
    where t.agreement_id = p_agreement_id
      and (a.requester_id = auth.uid() or a.supporter_id = auth.uid() or public.is_staff())
      and t.status = 'succeeded' and t.livemode and t.provider <> 'sandbox' and t.provider_ref is not null
  ) then 'funded' else 'not_funded' end;
$$;

-- ---------------------------------------------------------------------------
-- Append-only deal history (offers and the agreements created from them)
-- ---------------------------------------------------------------------------
create table public.deal_events (
  id           bigint generated always as identity primary key,
  offer_id     uuid not null references public.offers (id) on delete restrict,
  agreement_id uuid references public.agreements (id) on delete restrict,
  actor_id     uuid references public.profiles (id) on delete set null,
  event        text not null check (event ~ '^[a-z_]+$'),
  version      integer,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index deal_events_offer_idx on public.deal_events (offer_id, id);
create trigger deal_events_append_only before update or delete on public.deal_events
  for each row execute function public.prevent_mutation();
alter table public.deal_events enable row level security;
revoke all on public.deal_events from anon, authenticated;
grant select on public.deal_events to authenticated;
create policy deal_events_read on public.deal_events for select to authenticated
  using (public.is_staff() or exists (select 1 from public.offers o where o.id = offer_id
         and (o.requester_id = auth.uid() or o.supporter_id = auth.uid())));

create or replace function private.deal_event(p_offer uuid, p_agreement uuid, p_event text, p_version integer, p_detail jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.deal_events (offer_id, agreement_id, actor_id, event, version, detail)
  values (p_offer, p_agreement, auth.uid(), p_event, p_version, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Durable notifications: transactional outbox → in-app notifications.
-- Texts are fixed per type and never include message bodies, file names,
-- storage paths, evidence or amounts typed by members.
-- ---------------------------------------------------------------------------
create table private.notification_outbox (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null check (type ~ '^[a-z_]+$'),
  link_path       text check (link_path is null or link_path ~ '^/[^/]'),
  dedupe_key      text unique,
  status          text not null default 'pending' check (status in ('pending', 'sent', 'dead')),
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index notification_outbox_due_idx on private.notification_outbox (next_attempt_at) where status = 'pending';

create or replace function private.notification_text(p_type text, out title text, out body text)
language plpgsql immutable set search_path = '' as $$
begin
  case p_type
    when 'offer_received'      then title := 'New offer on your need';           body := 'Open SolveANeed to review it.';
    when 'offer_countered'     then title := 'Counter-offer received';           body := 'New terms are waiting for your response.';
    when 'offer_accepted'      then title := 'Offer accepted';                   body := 'An agreement has been created. No money has moved.';
    when 'offer_declined'      then title := 'Offer declined';                   body := null;
    when 'offer_withdrawn'     then title := 'Offer withdrawn';                  body := null;
    when 'offer_expired'       then title := 'Offer expired';                    body := null;
    when 'message_received'    then title := 'New message';                      body := 'You have a new message about an agreement.';
    when 'task_started'        then title := 'Work has started';                 body := null;
    when 'task_submitted'      then title := 'Work submitted for review';        body := 'Please review it against the agreed criteria.';
    when 'revision_requested'  then title := 'Revision requested';               body := null;
    when 'task_completed'      then title := 'Task completed';                   body := null;
    when 'agreement_cancelled' then title := 'Agreement cancelled';              body := null;
    when 'support_completed'   then title := 'Support marked as received';       body := null;
    when 'dispute_opened'      then title := 'A dispute has been opened';        body := 'SolveANeed will review it. Keep all communication on the platform.';
    when 'dispute_resolved'    then title := 'Dispute resolved';                 body := 'Open the agreement to see the outcome.';
    else raise exception 'Unknown notification type %', p_type using errcode = '22023';
  end case;
end $$;

create or replace function private.enqueue_notification(p_user uuid, p_type text, p_link text, p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.notification_text(p_type);  -- validates the type
  insert into private.notification_outbox (user_id, type, link_path, dedupe_key)
  values (p_user, p_type, p_link, p_dedupe)
  on conflict (dedupe_key) do nothing;
end $$;

-- Delivers due notifications. Safe to run concurrently (SKIP LOCKED); failed
-- deliveries are retried with exponential backoff and parked after 8 attempts.
create or replace function private.process_notification_outbox(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; t record; v_done integer := 0;
begin
  for r in select * from private.notification_outbox
           where status = 'pending' and next_attempt_at <= now()
           order by id limit greatest(1, least(p_limit, 500))
           for update skip locked loop
    begin
      select * into t from private.notification_text(r.type);
      insert into public.notifications (user_id, type, title, body, link_path)
      values (r.user_id, r.type, t.title, t.body, r.link_path);
      update private.notification_outbox set status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = null
       where id = r.id;
      v_done := v_done + 1;
    exception when others then
      update private.notification_outbox
         set attempts = attempts + 1,
             last_error = left(sqlerrm, 300),
             status = case when attempts + 1 >= 8 then 'dead' else 'pending' end,
             next_attempt_at = now() + make_interval(secs => least(3600, 15 * power(2, attempts)::integer))
       where id = r.id;
    end;
  end loop;
  return v_done;
end $$;

-- ---------------------------------------------------------------------------
-- Offer terms validation (per support type). Returns normalised terms with
-- only known keys, so nothing unexpected is ever stored in an agreement.
-- ---------------------------------------------------------------------------
create or replace function private.require_text(p_value text, p_label text, p_min integer, p_max integer)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := btrim(coalesce(p_value, ''));
begin
  if char_length(v) < p_min or char_length(v) > p_max then
    raise exception '% must be between % and % characters', p_label, p_min, p_max using errcode = '22023';
  end if;
  return v;
end $$;

create or replace function private.require_future_date(p_value text, p_label text)
returns date language plpgsql stable set search_path = '' as $$
declare d date;
begin
  begin
    d := p_value::date;
  exception when others then
    raise exception '% must be a valid date', p_label using errcode = '22023';
  end;
  if d is null or d <= current_date or d > current_date + 365 then
    raise exception '% must be between tomorrow and one year from now', p_label using errcode = '22023';
  end if;
  return d;
end $$;

create or replace function private.normalise_offer_terms(p_type public.support_type, p_amount bigint, p_terms jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  t jsonb := coalesce(p_terms, '{}'::jsonb);
  v_out jsonb;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_sum bigint := 0;
  v_msg text := nullif(btrim(coalesce(t ->> 'message', '')), '');
begin
  if jsonb_typeof(t) <> 'object' then
    raise exception 'Terms must be an object' using errcode = '22023';
  end if;
  if v_msg is not null and char_length(v_msg) > 2000 then
    raise exception 'Message must be 2,000 characters or fewer' using errcode = '22023';
  end if;

  if p_type = 'gift' then
    v_out := jsonb_build_object('message', v_msg);

  elsif p_type = 'paid_task' then
    if jsonb_typeof(t -> 'deliverables') <> 'array' or jsonb_array_length(t -> 'deliverables') not between 1 and 10 then
      raise exception 'List between 1 and 10 deliverables' using errcode = '22023';
    end if;
    for v_item in select * from jsonb_array_elements(t -> 'deliverables') loop
      v_items := v_items || to_jsonb(private.require_text(v_item #>> '{}', 'Each deliverable', 3, 300));
    end loop;
    if coalesce((t ->> 'remote_only')::boolean, false) is not true then
      raise exception 'Paid tasks on SolveANeed must be remote (no in-person work)' using errcode = '22023';
    end if;
    if (t ->> 'max_revisions') is null or (t ->> 'max_revisions') !~ '^[0-5]$' then
      raise exception 'Revisions allowed must be a whole number from 0 to 5' using errcode = '22023';
    end if;
    v_out := jsonb_build_object(
      'title',               private.require_text(t ->> 'title', 'Task title', 5, 120),
      'description',         private.require_text(t ->> 'description', 'Task description', 20, 4000),
      'deliverables',        v_items,
      'deadline',            private.require_future_date(t ->> 'deadline', 'Deadline'),
      'acceptance_criteria', private.require_text(t ->> 'acceptance_criteria', 'Acceptance criteria', 10, 2000),
      'max_revisions',       (t ->> 'max_revisions')::integer,
      'cancellation_policy', private.require_text(coalesce(t ->> 'cancellation_policy',
                               'Before work starts either party may cancel. After work starts, the supporter pays only for work delivered and accepted.'),
                               'Cancellation policy', 10, 1000),
      'remote_only',         true,
      'message',             v_msg);

  elsif p_type = 'milestone' then
    if jsonb_typeof(t -> 'milestones') <> 'array' or jsonb_array_length(t -> 'milestones') not between 1 and 10 then
      raise exception 'Add between 1 and 10 milestones' using errcode = '22023';
    end if;
    for v_item in select * from jsonb_array_elements(t -> 'milestones') loop
      if (v_item ->> 'amount_minor') is null or (v_item ->> 'amount_minor') !~ '^[1-9][0-9]{0,14}$' then
        raise exception 'Each milestone needs a positive amount' using errcode = '22023';
      end if;
      v_sum := v_sum + (v_item ->> 'amount_minor')::bigint;
      v_items := v_items || jsonb_build_object(
        'title',        private.require_text(v_item ->> 'title', 'Milestone title', 3, 120),
        'criteria',     private.require_text(v_item ->> 'criteria', 'Milestone criteria', 10, 1000),
        'evidence',     private.require_text(v_item ->> 'evidence', 'Evidence required', 5, 500),
        'amount_minor', (v_item ->> 'amount_minor')::bigint,
        'due_date',     private.require_future_date(v_item ->> 'due_date', 'Milestone due date'));
    end loop;
    if v_sum <> p_amount then
      raise exception 'Milestone amounts must add up exactly to the total' using errcode = '22023';
    end if;
    v_out := jsonb_build_object('milestones', v_items, 'message', v_msg);

  else -- direct_support (non-cash in Phase 3; supplier purchases arrive with payments)
    if p_amount <> 0 then
      raise exception 'Direct practical support is non-cash in this release' using errcode = '22023';
    end if;
    if coalesce(t ->> 'kind', '') not in ('time', 'expertise', 'mentoring') then
      raise exception 'Choose time, expertise or mentoring' using errcode = '22023';
    end if;
    if coalesce((t ->> 'online_or_public_only')::boolean, false) is not true then
      raise exception 'Direct support must take place online or in a public place' using errcode = '22023';
    end if;
    v_out := jsonb_build_object(
      'kind',                  t ->> 'kind',
      'description',           private.require_text(t ->> 'description', 'Description', 20, 2000),
      'schedule',              nullif(btrim(left(coalesce(t ->> 'schedule', ''), 500)), ''),
      'online_or_public_only', true,
      'message',               v_msg);
  end if;
  return jsonb_strip_nulls(v_out);
end $$;

-- Blocks payment details and identifiers outright; returns softer flags
-- (contact details, off-platform payment talk) as warnings and raises a
-- reviewer signal for them.
create or replace function private.screen_text(p_text text, p_entity_type text, p_entity_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare v_flags text[] := public.detect_sensitive_content(p_text);
begin
  if v_flags && array['bank_sort_code', 'bank_account_number', 'iban', 'card_number', 'sensitive_identifier'] then
    raise exception 'For your safety, do not share bank, card or identity details. Payments will only ever be made through SolveANeed.'
      using errcode = '22023';
  end if;
  if cardinality(v_flags) > 0 and p_entity_id is not null then
    insert into public.risk_signals (entity_type, entity_id, signal, detail)
    values (p_entity_type, p_entity_id, 'sensitive_content', jsonb_build_object('flags', v_flags));
  end if;
  return v_flags;
end $$;

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------
create or replace function private.offer_parties_ok(p_requester uuid, p_supporter uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_requester and account_status = 'active')
     or not exists (select 1 from public.profiles where id = p_supporter and account_status = 'active') then
    raise exception 'This member is not available' using errcode = '42501';
  end if;
  if public.is_blocked_between(p_requester, p_supporter) then
    raise exception 'You cannot interact with this member' using errcode = '42501';
  end if;
end $$;

create or replace function public.create_offer(p_need_id uuid, p_type public.support_type, p_amount_minor bigint, p_terms jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n public.needs%rowtype;
  v_terms jsonb;
  v_offer uuid := gen_random_uuid();
  v_flags text[];
  v_days integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'offer_expiry_days'), 14);
begin
  if auth.uid() is null or not public.is_active_user() or not public.has_role('supporter') then
    raise exception 'Only supporters can make offers' using errcode = '42501';
  end if;
  select * into n from public.needs where id = p_need_id;
  if not found or n.status <> 'published' then
    raise exception 'That need is not open for offers' using errcode = 'P0002';
  end if;
  if n.requester_id = auth.uid() then
    raise exception 'You cannot make an offer on your own need' using errcode = '22023';
  end if;
  perform private.offer_parties_ok(n.requester_id, auth.uid());
  if not (p_type = any (n.accepted_support_types)) then
    raise exception 'This need does not accept that type of support' using errcode = '22023';
  end if;
  if p_type = 'paid_task' and not coalesce((select open_to_paid_tasks from public.support_preferences
                                             where user_id = n.requester_id), false) then
    raise exception 'This member is not accepting paid tasks' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor < 0 or p_amount_minor > coalesce(n.amount_minor, 0) * 2 + 1 then
    raise exception 'Enter an amount up to twice the amount requested' using errcode = '22023';
  end if;
  if p_type <> 'direct_support' and p_amount_minor = 0 then
    raise exception 'Enter an amount' using errcode = '22023';
  end if;
  if exists (select 1 from public.offers where need_id = p_need_id and supporter_id = auth.uid()
             and status in ('proposed', 'countered')) then
    raise exception 'You already have an open offer on this need' using errcode = '22023';
  end if;
  if not private.hit(auth.uid()::text, 'create_offer') then
    raise exception 'Too many offers today. Please try again tomorrow.' using errcode = '54000';
  end if;
  v_terms := private.normalise_offer_terms(p_type, p_amount_minor, p_terms);
  v_flags := private.screen_text(v_terms::text, 'offer', null);

  insert into public.offers (id, need_id, requester_id, supporter_id, offer_type, status, amount_minor, currency,
                             current_version, last_proposed_by, expires_at)
  values (v_offer, n.id, n.requester_id, auth.uid(), p_type, 'proposed', p_amount_minor, n.currency,
          1, auth.uid(), now() + make_interval(days => v_days));
  insert into public.offer_versions (offer_id, version, proposed_by, amount_minor, currency, terms)
  values (v_offer, 1, auth.uid(), p_amount_minor, n.currency, v_terms);
  insert into public.conversations (need_id, offer_id, requester_id, supporter_id)
  values (n.id, v_offer, n.requester_id, auth.uid());
  if cardinality(v_flags) > 0 then
    perform private.screen_text(v_terms::text, 'offer', v_offer);
  end if;
  perform private.deal_event(v_offer, null, 'offer_proposed', 1,
                             jsonb_build_object('type', p_type, 'amount_minor', p_amount_minor, 'currency', n.currency));
  perform public.log_audit('offer.created', 'offer', v_offer, jsonb_build_object('need_id', n.id, 'type', p_type));
  perform private.enqueue_notification(n.requester_id, 'offer_received', '/dashboard/offers/' || v_offer);
  return jsonb_build_object('offer_id', v_offer, 'warnings', to_jsonb(v_flags));
end $$;

create or replace function private.lock_open_offer(p_offer_id uuid)
returns public.offers language plpgsql security definer set search_path = '' as $$
declare o public.offers%rowtype;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or auth.uid() not in (o.requester_id, o.supporter_id) then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if o.status not in ('proposed', 'countered') then
    raise exception 'This offer is no longer open' using errcode = '22023';
  end if;
  if o.expires_at is not null and o.expires_at <= now() then
    raise exception 'This offer has expired' using errcode = '22023';
  end if;
  if not public.is_active_user() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if not private.hit(auth.uid()::text, 'offer_response') then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000';
  end if;
  return o;
end $$;

create or replace function public.counter_offer(p_offer_id uuid, p_expected_version integer, p_amount_minor bigint, p_terms jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.offers%rowtype := private.lock_open_offer(p_offer_id);
  n public.needs%rowtype;
  v_terms jsonb;
  v_flags text[];
  v_other uuid;
  v_days integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'offer_expiry_days'), 14);
begin
  if o.current_version <> p_expected_version then
    raise exception 'These terms have changed. Please review the latest version.' using errcode = '40001';
  end if;
  if o.last_proposed_by = auth.uid() then
    raise exception 'Wait for the other member to respond to your latest terms' using errcode = '22023';
  end if;
  perform private.offer_parties_ok(o.requester_id, o.supporter_id);
  select * into n from public.needs where id = o.need_id;
  if n.status <> 'published' then
    raise exception 'That need is no longer open' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor < 0 or p_amount_minor > coalesce(n.amount_minor, 0) * 2 + 1 then
    raise exception 'Enter an amount up to twice the amount requested' using errcode = '22023';
  end if;
  if o.offer_type <> 'direct_support' and p_amount_minor = 0 then
    raise exception 'Enter an amount' using errcode = '22023';
  end if;
  v_terms := private.normalise_offer_terms(o.offer_type, p_amount_minor, p_terms);
  v_flags := private.screen_text(v_terms::text, 'offer', o.id);

  update public.offers
     set status = 'countered', amount_minor = p_amount_minor, current_version = o.current_version + 1,
         last_proposed_by = auth.uid(), expires_at = now() + make_interval(days => v_days)
   where id = o.id;
  insert into public.offer_versions (offer_id, version, proposed_by, amount_minor, currency, terms)
  values (o.id, o.current_version + 1, auth.uid(), p_amount_minor, o.currency, v_terms);
  perform private.deal_event(o.id, null, 'offer_countered', o.current_version + 1,
                             jsonb_build_object('amount_minor', p_amount_minor));
  perform public.log_audit('offer.countered', 'offer', o.id, jsonb_build_object('version', o.current_version + 1));
  v_other := case when auth.uid() = o.requester_id then o.supporter_id else o.requester_id end;
  perform private.enqueue_notification(v_other, 'offer_countered', '/dashboard/offers/' || o.id);
  return jsonb_build_object('version', o.current_version + 1, 'warnings', to_jsonb(v_flags));
end $$;

create or replace function public.accept_offer(p_offer_id uuid, p_expected_version integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  o public.offers%rowtype := private.lock_open_offer(p_offer_id);
  v public.offer_versions%rowtype;
  n public.needs%rowtype;
  v_snapshot jsonb;
  v_agreement uuid := gen_random_uuid();
  v_item jsonb;
  v_pos smallint := 0;
  v_other uuid;
begin
  if o.current_version <> p_expected_version then
    raise exception 'These terms have changed. Please review the latest version.' using errcode = '40001';
  end if;
  if o.last_proposed_by = auth.uid() then
    raise exception 'The other member must accept terms you proposed' using errcode = '22023';
  end if;
  perform private.offer_parties_ok(o.requester_id, o.supporter_id);
  select * into n from public.needs where id = o.need_id;
  if n.status <> 'published' then
    raise exception 'That need is no longer open' using errcode = '22023';
  end if;
  select * into v from public.offer_versions where offer_id = o.id and version = o.current_version;

  v_snapshot := jsonb_build_object(
    'schema', 'solveaneed.agreement.v1',
    'offer_id', o.id, 'version', v.version, 'version_id', v.id,
    'need_id', n.id, 'need_title', n.title,
    'type', o.offer_type, 'amount_minor', v.amount_minor, 'currency', v.currency,
    'requester_id', o.requester_id, 'supporter_id', o.supporter_id,
    'terms', v.terms, 'accepted_by', auth.uid(), 'accepted_at', now());

  update public.offers set status = 'accepted', accepted_version = v.version, accepted_at = now() where id = o.id;
  insert into public.agreements (id, offer_id, offer_version_id, agreement_type, requester_id, supporter_id,
                                 amount_minor, currency, terms_snapshot, terms_sha256, status, need_id,
                                 max_revisions, dispute_window_hours)
  values (v_agreement, o.id, v.id, o.offer_type, o.requester_id, o.supporter_id, v.amount_minor, v.currency,
          v_snapshot, encode(sha256(convert_to(v_snapshot::text, 'UTF8')), 'hex'),
          case when o.offer_type = 'direct_support' then 'active'::public.agreement_status
               else 'awaiting_payment_readiness'::public.agreement_status end,
          n.id,
          coalesce((v.terms ->> 'max_revisions')::smallint, 0),
          coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'task_dispute_window_hours'), 168));

  if o.offer_type = 'milestone' then
    for v_item in select * from jsonb_array_elements(v.terms -> 'milestones') loop
      v_pos := v_pos + 1;
      insert into public.agreement_milestones (agreement_id, position, title, acceptance_criteria, amount_minor, currency, due_date)
      values (v_agreement, v_pos, v_item ->> 'title',
              (v_item ->> 'criteria') || E'\nEvidence: ' || (v_item ->> 'evidence'),
              (v_item ->> 'amount_minor')::bigint, v.currency, (v_item ->> 'due_date')::date);
    end loop;
  end if;

  perform private.deal_event(o.id, v_agreement, 'offer_accepted', v.version, '{}'::jsonb);
  perform private.deal_event(o.id, v_agreement, 'agreement_created', v.version,
                             jsonb_build_object('terms_sha256', encode(sha256(convert_to(v_snapshot::text, 'UTF8')), 'hex')));
  perform public.log_audit('offer.accepted', 'offer', o.id, jsonb_build_object('agreement_id', v_agreement, 'version', v.version));
  v_other := case when auth.uid() = o.requester_id then o.supporter_id else o.requester_id end;
  perform private.enqueue_notification(v_other, 'offer_accepted', '/dashboard/agreements/' || v_agreement);
  return v_agreement;
end $$;

create or replace function public.decline_offer(p_offer_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.offers%rowtype := private.lock_open_offer(p_offer_id);
begin
  if auth.uid() <> o.requester_id then
    raise exception 'Only the requester can decline an offer; supporters can withdraw theirs' using errcode = '42501';
  end if;
  update public.offers set status = 'declined', closed_reason = nullif(btrim(left(p_reason, 1000)), ''), closed_at = now()
   where id = o.id;
  perform private.deal_event(o.id, null, 'offer_declined', o.current_version, '{}'::jsonb);
  perform public.log_audit('offer.declined', 'offer', o.id, '{}'::jsonb);
  perform private.enqueue_notification(o.supporter_id, 'offer_declined', '/dashboard/offers/' || o.id);
end $$;

create or replace function public.withdraw_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.offers%rowtype;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.supporter_id <> auth.uid() then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if o.status not in ('proposed', 'countered') then
    raise exception 'This offer is no longer open' using errcode = '22023';
  end if;
  update public.offers set status = 'cancelled', closed_at = now() where id = o.id;
  perform private.deal_event(o.id, null, 'offer_withdrawn', o.current_version, '{}'::jsonb);
  perform public.log_audit('offer.withdrawn', 'offer', o.id, '{}'::jsonb);
  perform private.enqueue_notification(o.requester_id, 'offer_withdrawn', '/dashboard/offers/' || o.id);
end $$;

-- ---------------------------------------------------------------------------
-- Agreements and the paid-task workflow
-- ---------------------------------------------------------------------------
create or replace function private.lock_agreement(p_agreement_id uuid)
returns public.agreements language plpgsql security definer set search_path = '' as $$
declare a public.agreements%rowtype;
begin
  select * into a from public.agreements where id = p_agreement_id for update;
  if not found or auth.uid() is null or auth.uid() not in (a.requester_id, a.supporter_id) then
    raise exception 'Agreement not found' using errcode = 'P0002';
  end if;
  if not public.is_active_user() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if not private.hit(auth.uid()::text, 'agreement_action') then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000';
  end if;
  return a;
end $$;

create or replace function public.start_task_work(p_agreement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.agreements%rowtype := private.lock_agreement(p_agreement_id);
begin
  if a.agreement_type <> 'paid_task' or auth.uid() <> a.requester_id then
    raise exception 'Only the person doing the task can start it' using errcode = '42501';
  end if;
  if a.status <> 'awaiting_payment_readiness' then
    raise exception 'This task cannot be started now' using errcode = '22023';
  end if;
  if public.is_blocked_between(a.requester_id, a.supporter_id) then
    raise exception 'You cannot interact with this member' using errcode = '42501';
  end if;
  if a.payment_ready_at is null and not public.setting_bool('sandbox_workflows') then
    raise exception 'Do not start work yet: payment is not ready. Payments are not yet available on SolveANeed.'
      using errcode = '22023';
  end if;
  update public.agreements
     set status = 'active', work_started_at = now(),
         test_mode = (a.payment_ready_at is null)   -- started without payment = test environment only
   where id = a.id;
  perform private.deal_event(a.offer_id, a.id, 'work_started', null,
                             jsonb_build_object('test_mode', a.payment_ready_at is null));
  perform public.log_audit('agreement.work_started', 'agreement', a.id, jsonb_build_object('test_mode', a.payment_ready_at is null));
  perform private.enqueue_notification(a.supporter_id, 'task_started', '/dashboard/agreements/' || a.id);
end $$;

create or replace function public.submit_task_work(p_agreement_id uuid, p_description text, p_attachment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.agreements%rowtype := private.lock_agreement(p_agreement_id);
  v_desc text := private.require_text(p_description, 'Description of the work', 20, 4000);
  v_path text;
  v_id uuid;
begin
  if a.agreement_type <> 'paid_task' or auth.uid() <> a.requester_id then
    raise exception 'Only the person doing the task can submit work' using errcode = '42501';
  end if;
  if a.status not in ('active', 'revision_requested') then
    raise exception 'Work cannot be submitted now' using errcode = '22023';
  end if;
  perform private.screen_text(v_desc, 'agreement', a.id);
  if p_attachment_id is not null then
    select f.storage_path into v_path from public.conversation_files f
      join public.conversations c on c.id = f.conversation_id
     where f.id = p_attachment_id and f.uploader_id = auth.uid() and c.offer_id = a.offer_id;
    if v_path is null then
      raise exception 'Attachment not found' using errcode = 'P0002';
    end if;
  end if;
  insert into public.task_deliverables (agreement_id, submitted_by, description, storage_path)
  values (a.id, auth.uid(), v_desc, v_path) returning id into v_id;
  update public.agreements set status = 'submitted', submitted_at = now() where id = a.id;
  perform private.deal_event(a.offer_id, a.id, 'work_submitted', null,
                             jsonb_build_object('deliverable_id', v_id, 'revision', a.revisions_used));
  perform public.log_audit('agreement.work_submitted', 'agreement', a.id, jsonb_build_object('deliverable_id', v_id));
  perform private.enqueue_notification(a.supporter_id, 'task_submitted', '/dashboard/agreements/' || a.id);
  return v_id;
end $$;

create or replace function public.review_task_work(p_agreement_id uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.agreements%rowtype := private.lock_agreement(p_agreement_id);
  v_note text := nullif(btrim(left(coalesce(p_note, ''), 2000)), '');
  v_deliverable uuid;
begin
  if a.agreement_type <> 'paid_task' or auth.uid() <> a.supporter_id then
    raise exception 'Only the supporter can review submitted work' using errcode = '42501';
  end if;
  if a.status <> 'submitted' then
    raise exception 'There is no submitted work to review' using errcode = '22023';
  end if;
  select id into v_deliverable from public.task_deliverables where agreement_id = a.id
   order by submitted_at desc limit 1;
  if p_decision = 'accept' then
    update public.task_deliverables set review_status = 'accepted', reviewed_at = now(), review_note = v_note
     where id = v_deliverable;
    update public.agreements set status = 'completed', completed_at = now() where id = a.id;
    update public.offers set status = 'completed' where id = a.offer_id;
    perform private.deal_event(a.offer_id, a.id, 'work_accepted', null, '{}'::jsonb);
    perform public.log_audit('agreement.completed', 'agreement', a.id, jsonb_build_object('by', 'supporter'));
    perform private.enqueue_notification(a.requester_id, 'task_completed', '/dashboard/agreements/' || a.id);
  elsif p_decision = 'revision' then
    if a.revisions_used >= a.max_revisions then
      raise exception 'All agreed revisions have been used. Accept the work or open a dispute.' using errcode = '22023';
    end if;
    if v_note is null or char_length(v_note) < 10 then
      raise exception 'Explain what needs to change against the acceptance criteria (10+ characters)' using errcode = '22023';
    end if;
    perform private.screen_text(v_note, 'agreement', a.id);
    update public.task_deliverables set review_status = 'revision_requested', reviewed_at = now(), review_note = v_note
     where id = v_deliverable;
    update public.agreements set status = 'revision_requested', revisions_used = a.revisions_used + 1 where id = a.id;
    perform private.deal_event(a.offer_id, a.id, 'revision_requested', null,
                               jsonb_build_object('revision', a.revisions_used + 1, 'of', a.max_revisions));
    perform public.log_audit('agreement.revision_requested', 'agreement', a.id, '{}'::jsonb);
    perform private.enqueue_notification(a.requester_id, 'revision_requested', '/dashboard/agreements/' || a.id);
  else
    raise exception 'Decision must be accept or revision' using errcode = '22023';
  end if;
end $$;

create or replace function public.confirm_support_received(p_agreement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.agreements%rowtype := private.lock_agreement(p_agreement_id);
begin
  if a.agreement_type <> 'direct_support' or auth.uid() <> a.requester_id then
    raise exception 'Only the requester can confirm support was received' using errcode = '42501';
  end if;
  if a.status <> 'active' then
    raise exception 'This agreement is not active' using errcode = '22023';
  end if;
  update public.agreements set status = 'completed', completed_at = now() where id = a.id;
  update public.offers set status = 'completed' where id = a.offer_id;
  perform private.deal_event(a.offer_id, a.id, 'support_received', null, '{}'::jsonb);
  perform public.log_audit('agreement.completed', 'agreement', a.id, jsonb_build_object('by', 'requester'));
  perform private.enqueue_notification(a.supporter_id, 'support_completed', '/dashboard/agreements/' || a.id);
end $$;

create or replace function public.cancel_agreement(p_agreement_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.agreements%rowtype := private.lock_agreement(p_agreement_id);
  v_reason text := private.require_text(p_reason, 'Reason', 5, 1000);
begin
  if a.status = 'awaiting_payment_readiness'
     or (a.status = 'active' and a.agreement_type = 'direct_support') then
    null; -- either party, before work or funds are involved
  elsif a.status in ('active', 'revision_requested') and auth.uid() = a.requester_id then
    null; -- the person doing the task may withdraw; the supporter is not charged
  else
    raise exception 'This agreement cannot be cancelled at this stage. Open a dispute if something has gone wrong.'
      using errcode = '22023';
  end if;
  update public.agreements set status = 'cancelled', cancelled_at = now() where id = a.id;
  update public.offers set status = 'cancelled', closed_reason = v_reason, closed_at = now() where id = a.offer_id;
  perform private.deal_event(a.offer_id, a.id, 'agreement_cancelled', null, jsonb_build_object('reason', v_reason));
  perform public.log_audit('agreement.cancelled', 'agreement', a.id, '{}'::jsonb);
  perform private.enqueue_notification(case when auth.uid() = a.requester_id then a.supporter_id else a.requester_id end,
                                       'agreement_cancelled', '/dashboard/agreements/' || a.id);
end $$;

create or replace function public.open_dispute(p_agreement_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.agreements%rowtype := private.lock_agreement(p_agreement_id);
  v_reason text := private.require_text(p_reason, 'Reason for the dispute', 20, 4000);
  v_id uuid;
begin
  if a.status not in ('active', 'submitted', 'revision_requested') then
    raise exception 'A dispute can only be opened while work is in progress or under review' using errcode = '22023';
  end if;
  if not private.hit(auth.uid()::text, 'open_dispute') then
    raise exception 'Too many disputes today.' using errcode = '54000';
  end if;
  perform private.screen_text(v_reason, 'agreement', a.id);
  insert into public.disputes (agreement_id, opened_by, reason) values (a.id, auth.uid(), v_reason) returning id into v_id;
  update public.agreements set status = 'disputed' where id = a.id;
  update public.offers set status = 'disputed' where id = a.offer_id;
  perform private.deal_event(a.offer_id, a.id, 'dispute_opened', null, jsonb_build_object('dispute_id', v_id));
  perform public.log_audit('dispute.opened', 'agreement', a.id, jsonb_build_object('dispute_id', v_id));
  perform private.enqueue_notification(case when auth.uid() = a.requester_id then a.supporter_id else a.requester_id end,
                                       'dispute_opened', '/dashboard/agreements/' || a.id);
  return v_id;
end $$;

-- Independent moderator decision. The moderator must not be a party.
create or replace function public.resolve_dispute(p_dispute_id uuid, p_outcome text, p_resolution text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.disputes%rowtype;
  a public.agreements%rowtype;
  v_text text := private.require_text(p_resolution, 'Resolution', 20, 4000);
begin
  if not public.is_staff() then
    raise exception 'Moderator role (with MFA) required' using errcode = '42501';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found' using errcode = 'P0002';
  end if;
  if d.status not in ('open', 'under_review') then
    raise exception 'This dispute is already resolved' using errcode = '22023';
  end if;
  select * into a from public.agreements where id = d.agreement_id for update;
  if auth.uid() in (a.requester_id, a.supporter_id) then
    raise exception 'You cannot decide a dispute you are part of' using errcode = '42501';
  end if;
  if p_outcome not in ('complete', 'cancel') then
    raise exception 'Outcome must be complete or cancel' using errcode = '22023';
  end if;
  update public.disputes set status = 'resolved', outcome = p_outcome, resolution = v_text,
                             resolved_by = auth.uid(), resolved_at = now(), assigned_to = coalesce(assigned_to, auth.uid())
   where id = d.id;
  if p_outcome = 'complete' then
    update public.agreements set status = 'completed', completed_at = now() where id = a.id;
    update public.offers set status = 'completed' where id = a.offer_id;
  else
    update public.agreements set status = 'cancelled', cancelled_at = now() where id = a.id;
    update public.offers set status = 'cancelled', closed_at = now() where id = a.offer_id;
  end if;
  perform private.deal_event(a.offer_id, a.id, 'dispute_resolved', null, jsonb_build_object('dispute_id', d.id, 'outcome', p_outcome));
  perform public.log_audit('dispute.resolved', 'agreement', a.id, jsonb_build_object('dispute_id', d.id, 'outcome', p_outcome));
  perform private.enqueue_notification(a.requester_id, 'dispute_resolved', '/dashboard/agreements/' || a.id, 'dispute_resolved:' || d.id || ':r');
  perform private.enqueue_notification(a.supporter_id, 'dispute_resolved', '/dashboard/agreements/' || a.id, 'dispute_resolved:' || d.id || ':s');
end $$;

-- ---------------------------------------------------------------------------
-- Scheduled work: offer expiry, task auto-acceptance, notification delivery.
-- ---------------------------------------------------------------------------
create or replace function private.run_scheduled_work()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_expired integer := 0; v_auto integer := 0; v_sent integer;
begin
  for r in select * from public.offers where status in ('proposed', 'countered') and expires_at <= now()
           for update skip locked loop
    update public.offers set status = 'expired', closed_at = now() where id = r.id;
    insert into public.deal_events (offer_id, event, version) values (r.id, 'offer_expired', r.current_version);
    perform private.enqueue_notification(r.requester_id, 'offer_expired', '/dashboard/offers/' || r.id, 'expired:' || r.id || ':r');
    perform private.enqueue_notification(r.supporter_id, 'offer_expired', '/dashboard/offers/' || r.id, 'expired:' || r.id || ':s');
    v_expired := v_expired + 1;
  end loop;
  -- Silence protects the person who did the work: submitted work is accepted
  -- automatically once the dispute window passes.
  for r in select * from public.agreements
           where status = 'submitted' and submitted_at + make_interval(hours => dispute_window_hours) <= now()
           for update skip locked loop
    update public.task_deliverables set review_status = 'accepted', reviewed_at = now(), review_note = 'Accepted automatically: review window passed'
     where agreement_id = r.id and review_status = 'pending';
    update public.agreements set status = 'completed', completed_at = now() where id = r.id;
    update public.offers set status = 'completed' where id = r.offer_id;
    insert into public.deal_events (offer_id, agreement_id, event) values (r.offer_id, r.id, 'work_auto_accepted');
    perform private.enqueue_notification(r.requester_id, 'task_completed', '/dashboard/agreements/' || r.id, 'auto:' || r.id || ':r');
    perform private.enqueue_notification(r.supporter_id, 'task_completed', '/dashboard/agreements/' || r.id, 'auto:' || r.id || ':s');
    v_auto := v_auto + 1;
  end loop;
  v_sent := private.process_notification_outbox(500);
  return jsonb_build_object('offers_expired', v_expired, 'tasks_auto_accepted', v_auto, 'notifications_delivered', v_sent);
end $$;

-- Called by the SolveANeed server (cron route and after member actions) with
-- the server token, like the anonymous rate limiter. Never by browsers.
create or replace function public.run_jobs(p_server_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  select value_hash into v_hash from private.app_secrets where name = 'jobs_server_token';
  if v_hash is null then
    select value_hash into v_hash from private.app_secrets where name = 'rate_limit_server_token';
  end if;
  if v_hash is null or encode(sha256(convert_to(coalesce(p_server_token, ''), 'UTF8')), 'hex') <> v_hash then
    raise exception 'Invalid server token' using errcode = '42501';
  end if;
  return private.run_scheduled_work();
end $$;

-- ---------------------------------------------------------------------------
-- Messaging: agreement-linked conversations, screened messages, private files
-- ---------------------------------------------------------------------------
alter table public.messages
  add column flags   text[] not null default '{}',
  add column file_id uuid;

create table public.conversation_files (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete restrict,
  uploader_id     uuid not null references public.profiles (id) on delete restrict,
  storage_path    text not null unique,
  file_name       text not null check (char_length(file_name) between 1 and 200),
  mime_type       text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes      integer not null check (size_bytes between 1 and 10485760),
  created_at      timestamptz not null default now()
);
alter table public.messages add constraint messages_file_fk foreign key (file_id) references public.conversation_files (id) on delete restrict;
alter table public.conversation_files enable row level security;
revoke all on public.conversation_files from anon, authenticated;
grant select on public.conversation_files to authenticated;
create policy conversation_files_read on public.conversation_files for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id
                 and (c.requester_id = auth.uid() or c.supporter_id = auth.uid())));

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon, authenticated;
grant select on public.conversation_reads to authenticated;
create policy conversation_reads_own on public.conversation_reads for select to authenticated using (user_id = auth.uid());

-- Messages are immutable once sent (records are kept for disputes).
create trigger messages_immutable before update or delete on public.messages
  for each row execute function public.prevent_mutation();

create or replace function private.lock_conversation(p_conversation_id uuid)
returns public.conversations language plpgsql security definer set search_path = '' as $$
declare c public.conversations%rowtype;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if not found or auth.uid() is null or auth.uid() not in (c.requester_id, c.supporter_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not public.is_active_user() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if public.is_blocked_between(c.requester_id, c.supporter_id) then
    raise exception 'You cannot message this member. Earlier messages are kept for safety and disputes.' using errcode = '42501';
  end if;
  return c;
end $$;

-- Register a file the member has just uploaded to the conversation-files bucket.
create or replace function public.register_conversation_file(p_conversation_id uuid, p_storage_path text, p_file_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations%rowtype := private.lock_conversation(p_conversation_id);
  o record;
  v_id uuid;
begin
  if (string_to_array(p_storage_path, '/'))[1] <> c.id::text or (string_to_array(p_storage_path, '/'))[2] <> auth.uid()::text then
    raise exception 'Invalid file path' using errcode = '22023';
  end if;
  select (metadata ->> 'mimetype') as mime, (metadata ->> 'size')::integer as size, owner_id
    into o from storage.objects where bucket_id = 'conversation-files' and name = p_storage_path;
  if not found or o.owner_id is distinct from auth.uid()::text then
    raise exception 'File not found' using errcode = 'P0002';
  end if;
  if not private.hit(auth.uid()::text, 'upload_attachment') then
    raise exception 'Too many uploads. Please try again later.' using errcode = '54000';
  end if;
  insert into public.conversation_files (conversation_id, uploader_id, storage_path, file_name, mime_type, size_bytes)
  values (c.id, auth.uid(), p_storage_path, private.require_text(regexp_replace(p_file_name, '[^A-Za-z0-9 ._()-]', '_', 'g'), 'File name', 1, 200),
          o.mime, o.size)
  returning id into v_id;
  perform public.log_audit('file.uploaded', 'conversation', c.id, jsonb_build_object('file_id', v_id));
  return v_id;
end $$;

create or replace function public.send_message(p_conversation_id uuid, p_body text, p_file_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations%rowtype := private.lock_conversation(p_conversation_id);
  v_body text := private.require_text(p_body, 'Message', 1, 4000);
  v_flags text[];
  v_id uuid := gen_random_uuid();
  v_other uuid;
begin
  if not private.hit(auth.uid()::text, 'send_message') then
    raise exception 'You are sending messages too quickly. Please wait a moment.' using errcode = '54000';
  end if;
  if p_file_id is not null and not exists (select 1 from public.conversation_files
                                           where id = p_file_id and conversation_id = c.id and uploader_id = auth.uid()) then
    raise exception 'Attachment not found' using errcode = 'P0002';
  end if;
  v_flags := private.screen_text(v_body, 'message', null);
  insert into public.messages (id, conversation_id, sender_id, body, flags, file_id)
  values (v_id, c.id, auth.uid(), v_body, v_flags, p_file_id);
  if cardinality(v_flags) > 0 then
    perform private.screen_text(v_body, 'message', v_id);
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at) values (c.id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
  v_other := case when auth.uid() = c.requester_id then c.supporter_id else c.requester_id end;
  -- One unread-message notification per conversation per hour.
  perform private.enqueue_notification(v_other, 'message_received', '/dashboard/offers/' || c.offer_id,
                                       'msg:' || c.id || ':' || v_other || ':' || to_char(now(), 'YYYYMMDDHH24'));
  return jsonb_build_object('message_id', v_id, 'warnings', to_jsonb(v_flags));
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.conversations where id = p_conversation_id
                 and auth.uid() in (requester_id, supporter_id)) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at) values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end $$;

-- Staff see a conversation only while it is part of an open case (a report on
-- one of its messages or its offer, or an open dispute), and every view is logged.
create or replace function public.staff_conversation_in_scope(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() and exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and (
      exists (select 1 from public.reports r where r.status in ('open', 'under_review')
              and ((r.target_type = 'message' and r.target_id in (select m.id from public.messages m where m.conversation_id = c.id))
                   or (r.target_type = 'offer' and r.target_id = c.offer_id)))
      or exists (select 1 from public.disputes d join public.agreements a on a.id = d.agreement_id
                 where a.offer_id = c.offer_id and d.status in ('open', 'under_review'))
      or exists (select 1 from public.risk_signals s where s.reviewed_at is null and s.entity_type = 'message'
                 and s.entity_id in (select m.id from public.messages m where m.conversation_id = c.id))
    ));
$$;

create or replace function public.staff_read_conversation(p_conversation_id uuid)
returns table (id uuid, sender_id uuid, sender_role text, body text, flags text[], file_id uuid, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.staff_conversation_in_scope(p_conversation_id) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  perform public.log_audit('conversation.viewed', 'conversation', p_conversation_id, '{}'::jsonb);
  return query
    select m.id, m.sender_id,
           case when m.sender_id = c.requester_id then 'requester' else 'supporter' end,
           m.body, m.flags, m.file_id, m.created_at
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = p_conversation_id order by m.created_at;
end $$;

create or replace function public.staff_conversation_id(p_offer_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.conversations c where c.offer_id = p_offer_id and public.is_staff();
$$;

-- General short-lived file grants for staff (conversation files in scope).
create table public.file_access_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index file_access_grants_lookup on public.file_access_grants (user_id, storage_path, expires_at);
alter table public.file_access_grants enable row level security;
revoke all on public.file_access_grants from anon, authenticated;

create or replace function public.authorise_conversation_file(p_file_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare f public.conversation_files%rowtype; c public.conversations%rowtype; v_seconds integer;
begin
  select * into f from public.conversation_files where id = p_file_id;
  if not found or auth.uid() is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  select * into c from public.conversations where id = f.conversation_id;
  if auth.uid() in (c.requester_id, c.supporter_id) then
    return f.storage_path;
  end if;
  if public.staff_conversation_in_scope(c.id) then
    v_seconds := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'evidence_grant_seconds'), 120);
    insert into public.file_access_grants (user_id, storage_path, expires_at)
    values (auth.uid(), f.storage_path, now() + make_interval(secs => v_seconds));
    perform public.log_audit('file.viewed', 'conversation', c.id, jsonb_build_object('file_id', f.id));
    return f.storage_path;
  end if;
  raise exception 'Not found' using errcode = 'P0002';
end $$;

create or replace function public.staff_has_file_grant(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.file_access_grants g
                 where g.user_id = auth.uid() and g.storage_path = p_path and g.expires_at > now());
$$;

create or replace function public.conversation_member(p_conversation_text text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c
                 where c.id::text = p_conversation_text and auth.uid() in (c.requester_id, c.supporter_id));
$$;

create or replace function public.conversation_upload_allowed(p_conversation_text text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c
                 where c.id::text = p_conversation_text and auth.uid() in (c.requester_id, c.supporter_id)
                   and not public.is_blocked_between(c.requester_id, c.supporter_id))
         and public.is_active_user();
$$;

-- Bucket: <conversation id>/<uploader id>/<random>.<ext>; private, no deletes by members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('conversation-files', 'conversation-files', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "conversation-files: participants upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'conversation-files'
              and (storage.foldername(name))[2] = auth.uid()::text
              and public.conversation_upload_allowed((storage.foldername(name))[1]));
create policy "conversation-files: participants, or staff with an active grant"
  on storage.objects for select to authenticated
  using (bucket_id = 'conversation-files'
         and (public.conversation_member((storage.foldername(name))[1]) or public.staff_has_file_grant(name)));

-- ---------------------------------------------------------------------------
-- Reports on messages and offers (extends submit_report)
-- ---------------------------------------------------------------------------
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
  elsif p_target_type = 'message' then
    if not exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                   where m.id = p_target_id and auth.uid() in (c.requester_id, c.supporter_id)) then
      raise exception 'That message could not be found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.messages where id = p_target_id and sender_id = auth.uid()) then
      raise exception 'You cannot report your own message' using errcode = '22023';
    end if;
  elsif p_target_type = 'offer' then
    if not exists (select 1 from public.offers where id = p_target_id and auth.uid() in (requester_id, supporter_id)) then
      raise exception 'That offer could not be found' using errcode = 'P0002';
    end if;
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

-- Staff: which offer a reported message belongs to (for opening the case).
create or replace function public.staff_offer_for_message(p_message_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select c.offer_id from public.messages m join public.conversations c on c.id = m.conversation_id
  where m.id = p_message_id and public.is_staff();
$$;

-- Staff read access to disputes is already granted by RLS (disputes_read).
-- Staff may also read agreements, offers and deal events (case handling);
-- conversations and messages remain private except via staff_read_conversation().

-- Whether a published need can receive paid-task offers (the requester has opted in).
create or replace function public.need_accepts_paid_tasks(p_need_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.needs n
    join public.support_preferences sp on sp.user_id = n.requester_id
    where n.id = p_need_id and n.status = 'published' and 'paid_task' = any (n.accepted_support_types)
      and sp.open_to_paid_tasks and auth.uid() is not null);
$$;

-- Display names of the two parties to an offer (parties and staff only).
create or replace function public.deal_party_names(p_offer_id uuid)
returns table (requester_name text, supporter_name text)
language sql stable security definer set search_path = '' as $$
  select rp.display_name, sp.display_name
  from public.offers o
  join public.profiles rp on rp.id = o.requester_id
  join public.profiles sp on sp.id = o.supporter_id
  where o.id = p_offer_id and (auth.uid() in (o.requester_id, o.supporter_id) or public.is_staff());
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: internal helpers are not callable by clients.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

revoke execute on function public.agreement_transition_allowed(public.agreement_status, public.agreement_status) from public;
grant execute on function public.agreement_transition_allowed(public.agreement_status, public.agreement_status) to authenticated;
revoke execute on function public.agreements_status_guard() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.agreement_funding_status(uuid)',
    'public.create_offer(uuid, public.support_type, bigint, jsonb)',
    'public.counter_offer(uuid, integer, bigint, jsonb)',
    'public.accept_offer(uuid, integer)',
    'public.decline_offer(uuid, text)',
    'public.withdraw_offer(uuid)',
    'public.start_task_work(uuid)',
    'public.submit_task_work(uuid, text, uuid)',
    'public.review_task_work(uuid, text, text)',
    'public.confirm_support_received(uuid)',
    'public.cancel_agreement(uuid, text)',
    'public.open_dispute(uuid, text)',
    'public.resolve_dispute(uuid, text, text)',
    'public.register_conversation_file(uuid, text, text)',
    'public.send_message(uuid, text, uuid)',
    'public.mark_conversation_read(uuid)',
    'public.staff_conversation_in_scope(uuid)',
    'public.staff_read_conversation(uuid)',
    'public.staff_conversation_id(uuid)',
    'public.authorise_conversation_file(uuid)',
    'public.staff_has_file_grant(text)',
    'public.conversation_member(text)',
    'public.conversation_upload_allowed(text)',
    'public.staff_offer_for_message(uuid)',
    'public.deal_party_names(uuid)',
    'public.need_accepts_paid_tasks(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- run_jobs is token-gated and called by the server (which may be signed out).
revoke execute on function public.run_jobs(text) from public;
grant execute on function public.run_jobs(text) to anon, authenticated;
