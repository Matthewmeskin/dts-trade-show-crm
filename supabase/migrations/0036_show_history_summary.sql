-- =============================================================================
-- DTS Trade Show CRM — 0036 Show history summary view
-- Reverse index over the legacy per-exhibitor show history: aggregates
-- exhibitor_show_history by (free-text) show_name so the app can answer "who
-- ships at this show historically?" — the legacy show names don't map 1:1 to
-- the edition-specific `shows` records, so this stays name-keyed. Run AFTER 0035.
--
-- security_invoker so the caller's RLS on exhibitor_show_history applies.
-- =============================================================================

create or replace view public.show_history_summary
with (security_invoker = on) as
select
  show_name,
  count(*)::int                                        as exhibitor_count,
  coalesce(sum(show_loads), 0)::int                    as total_loads,
  coalesce(sum(margin), 0)                             as total_margin,
  count(*) filter (where confirmed_2026 is not null)::int as confirmed_2026_count,
  min(first_year)                                      as first_year,
  max(last_year)                                       as last_year
from public.exhibitor_show_history
group by show_name;
