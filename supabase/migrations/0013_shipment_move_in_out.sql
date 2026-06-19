-- Move-in / move-out direction, the must-deliver-by target date, and the
-- relevant show date — so the team can see which loads are on track for a
-- move-in (where on-time delivery matters most).
--   direction            move_in (into the show) / move_out (back from it)
--   target_delivery_date  operator deadline; falls back to the show in the app
--   show_date             relevant show date; falls back to the show in the app
do $$
begin
  if not exists (select 1 from pg_type where typname = 'shipment_direction') then
    create type public.shipment_direction as enum ('move_in', 'move_out');
  end if;
end $$;

alter table public.shipments
  add column if not exists direction            public.shipment_direction,
  add column if not exists target_delivery_date date,
  add column if not exists show_date            date;

create index if not exists idx_shipments_direction on public.shipments (direction);
create index if not exists idx_shipments_target_delivery_date on public.shipments (target_delivery_date);
