-- =============================================================================
-- DTS Trade Show CRM — 0033 Activity log
-- Append-only audit trail of who did what: shipment edits, forced flags, status
-- changes, deletes, etc. Readable by any authenticated user; insert-only (no
-- update/delete) so the history can't be rewritten. Run AFTER 0032.
-- =============================================================================

create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid references public.profiles(id),
  action       text not null,   -- created | updated | deleted | forced | unforced | status_changed
  entity_type  text not null,   -- shipment | show | ...
  entity_id    uuid,
  entity_label text,            -- human-readable name at the time of the action
  summary      text,            -- what changed, in plain language
  details      jsonb            -- optional structured payload (field diffs, etc.)
);

create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_user_idx on public.activity_log (user_id);

alter table public.activity_log enable row level security;

-- Read for everyone signed in; insert for everyone signed in (writes happen in
-- server actions under the acting user's session). No update/delete policy →
-- the log is append-only.
create policy "activity_log: read (authenticated)"
  on public.activity_log for select to authenticated using (true);

create policy "activity_log: insert (authenticated)"
  on public.activity_log for insert to authenticated with check (true);
