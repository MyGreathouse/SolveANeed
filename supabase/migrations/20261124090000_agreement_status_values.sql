-- =============================================================================
-- SolveANeed — Phase 3 (1/2): new agreement states.
-- Kept in its own migration because new enum values cannot be used in the
-- same transaction that adds them.
--   revision_requested — paid task: supporter asked for a revision (within the agreed limit)
--   lapsed             — agreement ended because it never became payment-ready in time
-- =============================================================================
alter type public.agreement_status add value if not exists 'revision_requested' after 'submitted';
alter type public.agreement_status add value if not exists 'lapsed' after 'cancelled';
