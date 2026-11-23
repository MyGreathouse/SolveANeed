-- =============================================================================
-- SolveANeed — Migration 3: Organisations, offers, agreements, payments,
-- disputes, messaging (schema groundwork for Phases 3–5).
--
-- Phase 1 policy: participants can READ their own records; there are NO
-- client write policies. All writes will go through audited SECURITY DEFINER
-- RPCs (Phase 3) or the server-side payment service using the service role
-- (Phase 4). Live payments are disabled until explicitly approved.
-- =============================================================================

create type public.offer_status as enum
  ('draft', 'proposed', 'countered', 'accepted', 'declined', 'expired', 'cancelled', 'completed', 'disputed');
create type public.agreement_status as enum
  ('awaiting_payment_readiness', 'active', 'submitted', 'in_review', 'completed', 'cancelled', 'disputed');
create type public.milestone_status as enum
  ('pending', 'evidence_submitted', 'approved', 'rejected', 'paid', 'cancelled');
create type public.payment_status as enum
  ('created', 'requires_action', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');
create type public.payout_status as enum ('pending', 'approved', 'in_transit', 'paid', 'failed', 'cancelled');
create type public.refund_status as enum ('requested', 'processing', 'succeeded', 'failed', 'cancelled');
create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'appealed', 'closed');

-- ---------------------------------------------------------------------------
-- Organisations (business accounts — Phase 5, schema only)
-- ---------------------------------------------------------------------------
create table public.organisations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(name) between 2 and 120),
  registration_number text,
  country_code        char(2) not null default 'GB',
  website             text,
  verified_at         timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  member_role     text not null check (member_role in ('owner', 'approver', 'member')),
  created_at      timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Offers & versioned terms
-- ---------------------------------------------------------------------------
create table public.offers (
  id               uuid primary key default gen_random_uuid(),
  need_id          uuid not null references public.needs (id) on delete restrict,
  requester_id     uuid not null references public.profiles (id) on delete restrict,
  supporter_id     uuid not null references public.profiles (id) on delete restrict,
  organisation_id  uuid references public.organisations (id) on delete set null,
  offer_type       public.support_type not null,
  status           public.offer_status not null default 'draft',
  amount_minor     bigint not null check (amount_minor > 0),
  currency         char(3) not null references public.currencies (code),
  current_version  integer not null default 1 check (current_version >= 1),
  accepted_version integer,
  expires_at       timestamptz,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (requester_id <> supporter_id),
  check (status not in ('accepted', 'completed', 'disputed') or accepted_at is not null)
);
create index offers_need_idx on public.offers (need_id);
create index offers_requester_idx on public.offers (requester_id, status);
create index offers_supporter_idx on public.offers (supporter_id, status);
create trigger offers_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

-- Allowed offer transitions (mirrors lib/domain/offer-status.ts).
create or replace function public.offer_transition_allowed(p_from public.offer_status, p_to public.offer_status)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (
    ('draft'::public.offer_status, 'proposed'::public.offer_status),
    ('draft',     'cancelled'),
    ('proposed',  'countered'),
    ('proposed',  'accepted'),
    ('proposed',  'declined'),
    ('proposed',  'expired'),
    ('proposed',  'cancelled'),
    ('countered', 'countered'),
    ('countered', 'accepted'),
    ('countered', 'declined'),
    ('countered', 'expired'),
    ('countered', 'cancelled'),
    ('accepted',  'completed'),
    ('accepted',  'disputed'),
    ('accepted',  'cancelled'),
    ('disputed',  'completed'),
    ('disputed',  'cancelled')
  );
$$;

create or replace function public.offers_guard()
returns trigger language plpgsql set search_path = '' as $$
declare v_need_currency char(3);
begin
  select currency into v_need_currency from public.needs where id = new.need_id;
  if new.currency <> v_need_currency then
    raise exception 'Offer currency must match the need currency (%)', v_need_currency using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and not public.offer_transition_allowed(old.status, new.status) then
      raise exception 'Invalid offer status transition % -> %', old.status, new.status using errcode = '22023';
    end if;
    -- Once accepted, the commercial terms are frozen.
    if old.status in ('accepted', 'completed', 'disputed')
       and (new.amount_minor <> old.amount_minor or new.currency <> old.currency
            or new.offer_type <> old.offer_type or new.accepted_version is distinct from old.accepted_version) then
      raise exception 'Accepted offer terms are immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger offers_guard before insert or update on public.offers
  for each row execute function public.offers_guard();

create table public.offer_versions (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.offers (id) on delete cascade,
  version      integer not null check (version >= 1),
  proposed_by  uuid not null references public.profiles (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency     char(3) not null references public.currencies (code),
  terms        jsonb not null,  -- deliverables, deadline, acceptance criteria, revision/cancellation policy, dispute window
  created_at   timestamptz not null default now(),
  unique (offer_id, version)
);
create trigger offer_versions_immutable before update or delete on public.offer_versions
  for each row execute function public.prevent_mutation();

-- ---------------------------------------------------------------------------
-- Agreements (immutable snapshot of accepted terms)
-- ---------------------------------------------------------------------------
create table public.agreements (
  id               uuid primary key default gen_random_uuid(),
  offer_id         uuid not null unique references public.offers (id) on delete restrict,
  offer_version_id uuid not null references public.offer_versions (id) on delete restrict,
  agreement_type   public.support_type not null,
  requester_id     uuid not null references public.profiles (id) on delete restrict,
  supporter_id     uuid not null references public.profiles (id) on delete restrict,
  amount_minor     bigint not null check (amount_minor > 0),
  currency         char(3) not null references public.currencies (code),
  terms_snapshot   jsonb not null,
  terms_sha256     text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
  status           public.agreement_status not null default 'awaiting_payment_readiness',
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 5000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger agreements_updated_at before update on public.agreements
  for each row execute function public.set_updated_at();

create or replace function public.agreements_terms_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.terms_snapshot is distinct from old.terms_snapshot or new.terms_sha256 is distinct from old.terms_sha256
     or new.amount_minor <> old.amount_minor or new.currency <> old.currency
     or new.offer_version_id <> old.offer_version_id or new.platform_fee_bps <> old.platform_fee_bps then
    raise exception 'Agreement terms are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger agreements_terms_immutable before update on public.agreements
  for each row execute function public.agreements_terms_immutable();

create table public.agreement_milestones (
  id                    uuid primary key default gen_random_uuid(),
  agreement_id          uuid not null references public.agreements (id) on delete cascade,
  position              smallint not null check (position >= 1),
  title                 text not null,
  acceptance_criteria   text not null,
  amount_minor          bigint not null check (amount_minor > 0),
  currency              char(3) not null references public.currencies (code),
  due_date              date,
  status                public.milestone_status not null default 'pending',
  evidence_submitted_at timestamptz,
  decided_at            timestamptz,
  decided_by            uuid references public.profiles (id) on delete set null,
  unique (agreement_id, position)
);

create table public.task_deliverables (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.agreements (id) on delete cascade,
  submitted_by  uuid not null references public.profiles (id) on delete restrict,
  description   text not null,
  storage_path  text,
  submitted_at  timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'revision_requested', 'rejected')),
  reviewed_at   timestamptz,
  review_note   text
);

-- ---------------------------------------------------------------------------
-- Payments (provider-agnostic). Card data is NEVER stored here.
-- ---------------------------------------------------------------------------
create table public.payment_transactions (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null check (provider in ('sandbox', 'stripe')),
  provider_ref     text,
  idempotency_key  text not null unique,
  kind             text not null check (kind in ('contribution', 'task_payment', 'milestone_payment', 'direct_purchase')),
  livemode         boolean not null default false,
  payer_id         uuid references public.profiles (id) on delete set null,
  payee_id         uuid references public.profiles (id) on delete set null,
  need_id          uuid references public.needs (id) on delete set null,
  agreement_id     uuid references public.agreements (id) on delete set null,
  amount_minor     bigint not null check (amount_minor > 0),
  fee_minor        bigint not null default 0 check (fee_minor >= 0),
  currency         char(3) not null references public.currencies (code),
  status           public.payment_status not null default 'created',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider, provider_ref),
  check (fee_minor <= amount_minor),
  check (livemode = false) -- Live payments are blocked at the database level until explicitly approved.
);
create index payment_tx_payer_idx on public.payment_transactions (payer_id, created_at desc);
create index payment_tx_payee_idx on public.payment_transactions (payee_id, created_at desc);
create trigger payment_tx_updated_at before update on public.payment_transactions
  for each row execute function public.set_updated_at();

create table public.contributions (
  id                     uuid primary key default gen_random_uuid(),
  need_id                uuid not null references public.needs (id) on delete restrict,
  supporter_id           uuid references public.profiles (id) on delete set null,
  amount_minor           bigint not null check (amount_minor > 0),
  currency               char(3) not null references public.currencies (code),
  status                 public.payment_status not null default 'created',
  payment_transaction_id uuid references public.payment_transactions (id) on delete restrict,
  is_anonymous           boolean not null default false,
  created_at             timestamptz not null default now()
);
create index contributions_need_idx on public.contributions (need_id);
create index contributions_supporter_idx on public.contributions (supporter_id, created_at desc);

create or replace function public.contributions_currency_guard()
returns trigger language plpgsql set search_path = '' as $$
declare v_currency char(3);
begin
  select currency into v_currency from public.needs where id = new.need_id;
  if new.currency <> v_currency then
    raise exception 'Contribution currency must match the need currency (%)', v_currency using errcode = '22023';
  end if;
  return new;
end $$;
create trigger contributions_currency_guard before insert or update on public.contributions
  for each row execute function public.contributions_currency_guard();

create table public.provider_events (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null,
  event_id           text not null,
  event_type         text not null,
  payload            jsonb not null,
  signature_verified boolean not null,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  processing_error   text,
  unique (provider, event_id),           -- webhook idempotency
  check (signature_verified = true)      -- unverified events are rejected before insert
);

create table public.payouts (
  id                     uuid primary key default gen_random_uuid(),
  recipient_id           uuid not null references public.profiles (id) on delete restrict,
  agreement_id           uuid references public.agreements (id) on delete restrict,
  milestone_id           uuid references public.agreement_milestones (id) on delete restrict,
  amount_minor           bigint not null check (amount_minor > 0),
  currency               char(3) not null references public.currencies (code),
  status                 public.payout_status not null default 'pending',
  provider_ref           text,
  idempotency_key        text not null unique,
  approved_by            uuid references public.profiles (id) on delete set null,
  approved_at            timestamptz,
  created_at             timestamptz not null default now(),
  check (status not in ('approved', 'in_transit', 'paid') or approved_by is not null)
);

create table public.refunds (
  id                     uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions (id) on delete restrict,
  amount_minor           bigint not null check (amount_minor > 0),
  currency               char(3) not null references public.currencies (code),
  reason                 text not null,
  status                 public.refund_status not null default 'requested',
  provider_ref           text,
  idempotency_key        text not null unique,
  requested_by           uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now()
);

create or replace function public.refunds_guard()
returns trigger language plpgsql set search_path = '' as $$
declare t public.payment_transactions%rowtype; v_refunded bigint;
begin
  select * into t from public.payment_transactions where id = new.payment_transaction_id;
  if new.currency <> t.currency then
    raise exception 'Refund currency must match the original payment' using errcode = '22023';
  end if;
  select coalesce(sum(amount_minor), 0) into v_refunded from public.refunds
   where payment_transaction_id = t.id and status <> 'failed' and status <> 'cancelled'
     and id <> new.id;
  if v_refunded + new.amount_minor > t.amount_minor then
    raise exception 'Refunds cannot exceed the original payment' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger refunds_guard before insert or update on public.refunds
  for each row execute function public.refunds_guard();

-- ---------------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------------
create table public.disputes (
  id           uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements (id) on delete restrict,
  opened_by    uuid not null references public.profiles (id) on delete restrict,
  reason       text not null,
  status       public.dispute_status not null default 'open',
  resolution   text,
  resolved_by  uuid references public.profiles (id) on delete set null,
  opened_at    timestamptz not null default now(),
  resolved_at  timestamptz
);

create table public.dispute_evidence (
  id           uuid primary key default gen_random_uuid(),
  dispute_id   uuid not null references public.disputes (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  description  text not null,
  storage_path text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messaging (linked to offers/agreements)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  need_id      uuid references public.needs (id) on delete set null,
  offer_id     uuid unique references public.offers (id) on delete set null,
  requester_id uuid not null references public.profiles (id) on delete restrict,
  supporter_id uuid not null references public.profiles (id) on delete restrict,
  blocked_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (requester_id <> supporter_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete restrict,
  body            text not null check (char_length(body) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS: participants read; no client writes in Phase 1.
-- ---------------------------------------------------------------------------
alter table public.organisations         enable row level security;
alter table public.organisation_members  enable row level security;
alter table public.offers                enable row level security;
alter table public.offer_versions        enable row level security;
alter table public.agreements            enable row level security;
alter table public.agreement_milestones  enable row level security;
alter table public.task_deliverables     enable row level security;
alter table public.payment_transactions  enable row level security;
alter table public.contributions         enable row level security;
alter table public.provider_events       enable row level security;
alter table public.payouts               enable row level security;
alter table public.refunds               enable row level security;
alter table public.disputes              enable row level security;
alter table public.dispute_evidence      enable row level security;
alter table public.conversations         enable row level security;
alter table public.messages              enable row level security;

revoke all on public.organisations, public.organisation_members, public.offers, public.offer_versions,
              public.agreements, public.agreement_milestones, public.task_deliverables,
              public.payment_transactions, public.contributions, public.provider_events, public.payouts,
              public.refunds, public.disputes, public.dispute_evidence, public.conversations, public.messages
  from anon, authenticated;

grant select on public.organisations, public.organisation_members, public.offers, public.offer_versions,
                public.agreements, public.agreement_milestones, public.task_deliverables,
                public.payment_transactions, public.contributions, public.payouts, public.refunds,
                public.disputes, public.dispute_evidence, public.conversations, public.messages
  to authenticated;
-- provider_events: service role only (no grant to clients at all).

create policy org_read on public.organisations for select to authenticated
  using (public.is_staff() or exists (select 1 from public.organisation_members m
                                      where m.organisation_id = organisations.id and m.user_id = auth.uid()));
create policy org_members_read on public.organisation_members for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy offers_read on public.offers for select to authenticated
  using (requester_id = auth.uid() or supporter_id = auth.uid() or public.is_staff());
create policy offer_versions_read on public.offer_versions for select to authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id
                 and (o.requester_id = auth.uid() or o.supporter_id = auth.uid() or public.is_staff())));

create policy agreements_read on public.agreements for select to authenticated
  using (requester_id = auth.uid() or supporter_id = auth.uid() or public.is_staff());
create policy milestones_read on public.agreement_milestones for select to authenticated
  using (exists (select 1 from public.agreements a where a.id = agreement_id
                 and (a.requester_id = auth.uid() or a.supporter_id = auth.uid() or public.is_staff())));
create policy deliverables_read on public.task_deliverables for select to authenticated
  using (exists (select 1 from public.agreements a where a.id = agreement_id
                 and (a.requester_id = auth.uid() or a.supporter_id = auth.uid() or public.is_staff())));

create policy payments_read on public.payment_transactions for select to authenticated
  using (payer_id = auth.uid() or payee_id = auth.uid() or public.has_role('admin'));
create policy contributions_read on public.contributions for select to authenticated
  using (supporter_id = auth.uid() or public.has_role('admin')
         or exists (select 1 from public.needs n where n.id = need_id and n.requester_id = auth.uid()));
create policy payouts_read on public.payouts for select to authenticated
  using (recipient_id = auth.uid() or public.has_role('admin'));
create policy refunds_read on public.refunds for select to authenticated
  using (public.has_role('admin') or exists (select 1 from public.payment_transactions t
         where t.id = payment_transaction_id and (t.payer_id = auth.uid() or t.payee_id = auth.uid())));

create policy disputes_read on public.disputes for select to authenticated
  using (public.is_staff() or exists (select 1 from public.agreements a where a.id = agreement_id
         and (a.requester_id = auth.uid() or a.supporter_id = auth.uid())));
create policy dispute_evidence_read on public.dispute_evidence for select to authenticated
  using (public.is_staff() or exists (select 1 from public.disputes d join public.agreements a on a.id = d.agreement_id
         where d.id = dispute_id and (a.requester_id = auth.uid() or a.supporter_id = auth.uid())));

create policy conversations_read on public.conversations for select to authenticated
  using (requester_id = auth.uid() or supporter_id = auth.uid());
create policy messages_read on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id
                 and (c.requester_id = auth.uid() or c.supporter_id = auth.uid())));
-- Moderator access to messages is deliberately NOT granted by RLS; it will be
-- provided through an audited, report-scoped RPC per the documented policy.
