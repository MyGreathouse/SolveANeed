-- =============================================================================
-- SolveANeed — Migration 5: evidence access logging, notification helpers,
-- moderation statistics.
-- =============================================================================

-- Returns the storage path for an evidence file IF the caller may read it,
-- and writes an audit event whenever a member of staff (not the owner)
-- opens someone's private evidence.
create or replace function public.authorise_evidence_access(p_evidence_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare e public.need_evidence%rowtype;
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
  if public.is_staff() then
    perform public.log_audit('evidence.viewed', 'need', e.need_id,
                             jsonb_build_object('evidence_id', e.id, 'owner_id', e.owner_id));
    return e.storage_path;
  end if;
  raise exception 'Not found' using errcode = 'P0002';
end $$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- Aggregate counts for the moderation overview (staff only).
create or replace function public.moderation_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pending_needs',   (select count(*) from public.needs where status = 'pending_review'),
    'published_needs', (select count(*) from public.needs where status = 'published'),
    'open_reports',    (select count(*) from public.reports where status in ('open', 'under_review')),
    'open_signals',    (select count(*) from public.risk_signals where reviewed_at is null),
    'members',         (select count(*) from public.profiles where account_status = 'active'),
    'suspended',       (select count(*) from public.profiles where account_status = 'suspended')
  );
end $$;

create or replace function public.mark_risk_signal_reviewed(p_signal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Moderator role required' using errcode = '42501';
  end if;
  update public.risk_signals set reviewed_at = now(), reviewed_by = auth.uid() where id = p_signal_id;
  perform public.log_audit('risk_signal.reviewed', 'risk_signal', p_signal_id, '{}'::jsonb);
end $$;

-- Staff need limited profile info (display name, status) to moderate.
-- profiles_select_own already allows staff to read profiles.

revoke execute on function public.authorise_evidence_access(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
revoke execute on function public.moderation_stats() from public, anon;
revoke execute on function public.mark_risk_signal_reviewed(uuid) from public, anon;
grant execute on function public.authorise_evidence_access(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.moderation_stats() to authenticated;
grant execute on function public.mark_risk_signal_reviewed(uuid) to authenticated;
