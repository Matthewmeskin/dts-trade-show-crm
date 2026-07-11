-- Aggregate shipment counts per directory entity, computed in the database so
-- the Exhibitors / Carriers / Venues list pages don't pull the whole shipments
-- table into the app just to count loads per row.

create or replace function public.exhibitor_shipment_stats(
  p_from date default null,
  p_to date default null
)
returns table(exhibitor_id uuid, load_count bigint, show_ids uuid[])
language sql
stable
security invoker
as $$
  select s.exhibitor_id,
         count(*)::bigint as load_count,
         array_agg(distinct s.show_id) filter (where s.show_id is not null) as show_ids
  from public.shipments s
  where s.exhibitor_id is not null
    and (p_from is null or s.pickup_date >= p_from)
    and (p_to is null or s.pickup_date <= p_to)
  group by s.exhibitor_id;
$$;

create or replace function public.carrier_shipment_stats(
  p_from date default null,
  p_to date default null
)
returns table(carrier_id uuid, shipment_count bigint)
language sql
stable
security invoker
as $$
  select s.carrier_id, count(*)::bigint
  from public.shipments s
  where s.carrier_id is not null
    and (p_from is null or s.pickup_date >= p_from)
    and (p_to is null or s.pickup_date <= p_to)
  group by s.carrier_id;
$$;

create or replace function public.venue_shipment_stats()
returns table(venue_id uuid, load_count bigint)
language sql
stable
security invoker
as $$
  select s.venue_id, count(*)::bigint
  from public.shipments s
  where s.venue_id is not null
  group by s.venue_id;
$$;

grant execute on function public.exhibitor_shipment_stats(date, date) to anon, authenticated, service_role;
grant execute on function public.carrier_shipment_stats(date, date) to anon, authenticated, service_role;
grant execute on function public.venue_shipment_stats() to anon, authenticated, service_role;
