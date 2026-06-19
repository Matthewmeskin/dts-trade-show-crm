-- Candidates surfaced by the AI Load Finder: TMS loads that look like
-- trade-show freight, pending operator review (add / dismiss).
create table if not exists public.tms_load_candidates (
  id uuid primary key default gen_random_uuid(),
  load_number text not null unique,
  tms_status text,
  mode text,
  pickup_location text,
  delivery_location text,
  carrier_name text,
  pieces integer,
  weight numeric,
  ai_is_candidate boolean not null default false,
  ai_confidence text,
  ai_reason text,
  matched_venue text,
  review_status text not null default 'new',   -- new / dismissed / imported
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tms_load_candidates enable row level security;

drop policy if exists "authenticated read candidates" on public.tms_load_candidates;
create policy "authenticated read candidates"
  on public.tms_load_candidates for select to authenticated using (true);

drop policy if exists "authenticated update candidates" on public.tms_load_candidates;
create policy "authenticated update candidates"
  on public.tms_load_candidates for update to authenticated using (true) with check (true);

grant select, update on public.tms_load_candidates to authenticated;
grant all on public.tms_load_candidates to service_role;
