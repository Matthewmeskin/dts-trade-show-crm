-- =============================================================================
-- DTS Trade Show CRM — 0039 Show roster (authoritative 2026 attendance)
-- Roster Match can save a show's uploaded exhibitor list as the real record of
-- who's exhibiting that show in a given year (default 2026), replacing the
-- fuzzy scraped `confirmed_2026` guess. Keyed on the canonical show name so it
-- lines up with show_history_summary. Run AFTER 0038.
-- =============================================================================

create table if not exists public.exhibitor_show_roster (
  id           uuid primary key default gen_random_uuid(),
  show_name    text not null,                 -- canonical show name
  year         int  not null default 2026,
  exhibitor_id uuid not null references public.exhibitors(id) on delete cascade,
  source       text not null default 'roster_upload',
  created_at   timestamptz not null default now(),
  unique (show_name, year, exhibitor_id)
);

create index if not exists exhibitor_show_roster_show_idx on public.exhibitor_show_roster (show_name, year);
create index if not exists exhibitor_show_roster_exhibitor_idx on public.exhibitor_show_roster (exhibitor_id);

alter table public.exhibitor_show_roster enable row level security;
create policy "exhibitor_show_roster: all (authenticated)"
  on public.exhibitor_show_roster for all to authenticated using (true) with check (true);

-- Prefer a saved 2026 roster for "Returning 2026"; fall back to the fuzzy scrape
-- when no roster has been uploaded for a show. has_roster_2026 tells the UI which.
create or replace view public.show_history_summary
with (security_invoker = on) as
select
  h.canonical_show_name               as show_name,
  count(distinct h.exhibitor_id)::int as exhibitor_count,
  coalesce(sum(h.show_loads), 0)::int as total_loads,
  coalesce(sum(h.margin), 0)          as total_margin,
  coalesce(
    r.roster_count,
    count(distinct h.exhibitor_id) filter (
      where h.confirmed_2026 is not null
        and length(regexp_replace(lower(h.canonical_show_name), '[^a-z0-9]', '', 'g')) >= 3
        and regexp_replace(lower(h.confirmed_2026), '[^a-z0-9]', '', 'g')
            like '%' || regexp_replace(lower(h.canonical_show_name), '[^a-z0-9]', '', 'g') || '%'
    )
  )::int                              as confirmed_2026_count,
  min(h.first_year)                   as first_year,
  max(h.last_year)                    as last_year,
  (r.roster_count is not null)        as has_roster_2026
from public.exhibitor_show_history h
left join (
  select show_name, count(*)::int as roster_count
  from public.exhibitor_show_roster
  where year = 2026
  group by show_name
) r on r.show_name = h.canonical_show_name
group by h.canonical_show_name, r.roster_count;
