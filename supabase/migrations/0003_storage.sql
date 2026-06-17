-- =============================================================================
-- DTS Trade Show CRM — 0003 Storage
-- Private `documents` bucket for show files (exhibitor kits, routing guides,
-- floor maps, advance-warehouse forms, etc). Access via the app using
-- authenticated requests / signed URLs. Run AFTER 0002_rls.sql.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Authenticated users can read, upload, update, and delete objects in the
-- `documents` bucket. anon users get nothing.
create policy "documents bucket: read (authenticated)"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents');

create policy "documents bucket: insert (authenticated)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

create policy "documents bucket: update (authenticated)"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents') with check (bucket_id = 'documents');

create policy "documents bucket: delete (authenticated)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents');
