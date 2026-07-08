-- =============================================================================
-- DTS Trade Show CRM — 0029 MHA Check
-- Backs the Material Handling Agreement (MHA) verification tool.
--   * mha_submissions      — one row per uploaded MHA (photo/scan/PDF)
--   * mha_review_results   — the deterministic rule-engine output for a submission
--   * document_type 'MHA'  — lets a verified MHA attach to the load profile
--   * mha-uploads bucket    — private storage for the uploaded files
-- Follows the project convention: full access for any authenticated user,
-- anon gets nothing. Run AFTER 0028_load_candidate_customer_id.sql.
-- =============================================================================

-- Attaching a verified MHA to its load reuses the existing documents table, so
-- the enum needs an MHA value. Safe to add here: no statement in this migration
-- uses the new value (the app inserts MHA documents at runtime).
alter type public.document_type add value if not exists 'MHA';

-- ---------------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------------
create table public.mha_submissions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  submitter_name    text not null,
  submitter_phone   text not null,
  submitter_email   text not null,
  company_name      text not null,
  load_number_input text,                                       -- exactly what the user typed
  load_id           uuid references public.shipments(id),       -- null when no match
  match_method      text check (match_method in ('exact', 'fuzzy', 'none')),
  storage_path      text not null,
  file_mime         text not null,
  file_bytes        integer not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'passed', 'warning', 'failed', 'error'))
);

-- ---------------------------------------------------------------------------
-- Review results (deterministic rule-engine output)
-- ---------------------------------------------------------------------------
create table public.mha_review_results (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.mha_submissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  gc_detected   text,                     -- 'freeman' | 'ges' | 'shepard' | 'unknown'
  model         text not null,
  extracted     jsonb not null,           -- raw model output
  checks        jsonb not null,           -- array of CheckResult
  overall       text not null check (overall in ('passed', 'warning', 'failed'))
);

create index mha_submissions_load_id_idx on public.mha_submissions (load_id);
create index mha_review_results_submission_id_idx on public.mha_review_results (submission_id);

-- ---------------------------------------------------------------------------
-- RLS — full access for any authenticated user (project convention).
-- ---------------------------------------------------------------------------
alter table public.mha_submissions    enable row level security;
alter table public.mha_review_results enable row level security;

create policy "mha_submissions: all (authenticated)"
  on public.mha_submissions for all to authenticated using (true) with check (true);

create policy "mha_review_results: all (authenticated)"
  on public.mha_review_results for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Private storage bucket for uploaded MHAs. Access via signed URLs only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('mha-uploads', 'mha-uploads', false)
on conflict (id) do nothing;

create policy "mha-uploads bucket: read (authenticated)"
  on storage.objects for select to authenticated
  using (bucket_id = 'mha-uploads');

create policy "mha-uploads bucket: insert (authenticated)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mha-uploads');

create policy "mha-uploads bucket: update (authenticated)"
  on storage.objects for update to authenticated
  using (bucket_id = 'mha-uploads') with check (bucket_id = 'mha-uploads');

create policy "mha-uploads bucket: delete (authenticated)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mha-uploads');
