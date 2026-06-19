-- Shows a carrier services — a manual many-to-many like carrier_venues, so the
-- carrier record can list the shows it covers (separate from shipment history).
create table if not exists public.carrier_shows (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references public.carriers (id) on delete cascade,
  show_id     uuid not null references public.shows (id)    on delete cascade,
  unique (carrier_id, show_id)
);

create index if not exists idx_carrier_shows_carrier on public.carrier_shows (carrier_id);
create index if not exists idx_carrier_shows_show    on public.carrier_shows (show_id);

alter table public.carrier_shows enable row level security;

drop policy if exists "carrier_shows: all (authenticated)" on public.carrier_shows;
create policy "carrier_shows: all (authenticated)"
  on public.carrier_shows for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.carrier_shows to authenticated, service_role;
