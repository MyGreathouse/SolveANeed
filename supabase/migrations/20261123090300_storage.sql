-- =============================================================================
-- SolveANeed — Migration 4: Private storage for need evidence.
-- Object path convention: <owner uuid>/<need uuid>/<random uuid>.<ext>
-- Files are never public; access is via short-lived signed URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('need-evidence', 'need-evidence', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "need-evidence: owner uploads to own editable need"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'need-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.needs n
       where n.id::text = (storage.foldername(name))[2]
         and n.requester_id = auth.uid()
         and n.status in ('draft', 'changes_requested')
    )
  );

create policy "need-evidence: owner or staff can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'need-evidence'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

create policy "need-evidence: owner deletes while editable"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'need-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.needs n
       where n.id::text = (storage.foldername(name))[2]
         and n.status in ('draft', 'changes_requested')
    )
  );
