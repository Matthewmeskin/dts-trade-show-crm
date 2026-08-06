-- =============================================================================
-- DTS Trade Show CRM — 0037 Fix show_history_summary 2026 count
-- confirmed_2026 on each history row is the customer's WHOLE list of 2026-
-- confirmed shows (duplicated across their rows), not a per-show flag. The
-- original view counted any non-null value, which over-counted "returning in
-- 2026". Recompute it as: this show appears in the customer's 2026 list,
-- comparing on alphanumerics only (names differ between the legacy history and
-- the 2026 list). Run AFTER 0036.
-- =============================================================================

create or replace view public.show_history_summary
with (security_invoker = on) as
select
  show_name,
  count(*)::int                     as exhibitor_count,
  coalesce(sum(show_loads), 0)::int as total_loads,
  coalesce(sum(margin), 0)          as total_margin,
  count(*) filter (
    where confirmed_2026 is not null
      and length(regexp_replace(lower(show_name), '[^a-z0-9]', '', 'g')) >= 3
      and regexp_replace(lower(confirmed_2026), '[^a-z0-9]', '', 'g')
          like '%' || regexp_replace(lower(show_name), '[^a-z0-9]', '', 'g') || '%'
  )::int                            as confirmed_2026_count,
  min(first_year)                   as first_year,
  max(last_year)                    as last_year
from public.exhibitor_show_history
group by show_name;
