-- =============================================================================
-- SolveANeed — Migration 7: authoritative MFA-enrolment check (finding S10).
--
-- The app previously derived "has this member enrolled MFA?" from the session
-- object stored in the cookie, which is not authenticated. A member's stolen
-- password plus an edited cookie could skip the member's (optional) MFA prompt.
-- Staff were not affected (the database checks the signed aal claim).
-- This function answers from auth.mfa_factors for the verified JWT subject.
-- =============================================================================
create or replace function public.my_mfa_enrolled()
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
end $$;
revoke execute on function public.my_mfa_enrolled() from public, anon;
grant execute on function public.my_mfa_enrolled() to authenticated;
