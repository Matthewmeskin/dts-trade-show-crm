-- =============================================================================
-- DTS Trade Show CRM — 0038 Canonical show names
-- The legacy "Customers by Show" names are messy: FABTECH alone appears as
-- "FABTECH", "EXHIBITUS/FABTECH", "Fabtech - McCormick Place", "FABTECH
-- MCCORMICK PLACE", "Fab Tech", etc., so the Show History list fragments.
-- Consolidate each name to a canonical anchor — a cleanly-named show with >= 5
-- exhibitors whose (alphanumeric) name is contained in the variant; longest
-- anchor wins, else the name maps to itself. Purely a display grouping; the raw
-- show_name is kept per row. Run AFTER 0037.
-- =============================================================================

alter table public.exhibitor_show_history
  add column if not exists canonical_show_name text;

with counts as (
  select show_name, count(*) c,
         regexp_replace(lower(show_name), '[^a-z0-9]', '', 'g') as norm
  from public.exhibitor_show_history
  group by show_name
),
anchors as (
  select show_name as anchor, norm from counts where c >= 5 and length(norm) >= 5
)
update public.exhibitor_show_history h
set canonical_show_name = coalesce(
  (select a.anchor from anchors a
     where regexp_replace(lower(h.show_name), '[^a-z0-9]', '', 'g') like '%' || a.norm || '%'
     order by length(a.norm) desc
     limit 1),
  h.show_name);

create index if not exists exhibitor_show_history_canonical_idx
  on public.exhibitor_show_history (canonical_show_name);

-- Re-key the summary on the canonical name, counting DISTINCT exhibitors (a
-- customer may have several variant rows that now collapse into one show).
create or replace view public.show_history_summary
with (security_invoker = on) as
select
  canonical_show_name               as show_name,
  count(distinct exhibitor_id)::int as exhibitor_count,
  coalesce(sum(show_loads), 0)::int as total_loads,
  coalesce(sum(margin), 0)          as total_margin,
  count(distinct exhibitor_id) filter (
    where confirmed_2026 is not null
      and length(regexp_replace(lower(canonical_show_name), '[^a-z0-9]', '', 'g')) >= 3
      and regexp_replace(lower(confirmed_2026), '[^a-z0-9]', '', 'g')
          like '%' || regexp_replace(lower(canonical_show_name), '[^a-z0-9]', '', 'g') || '%'
  )::int                            as confirmed_2026_count,
  min(first_year)                   as first_year,
  max(last_year)                    as last_year
from public.exhibitor_show_history
group by canonical_show_name;
