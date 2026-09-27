-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260828021212 "tradeshow_crm_part3_recent".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- Tradeshow CRM part 3/3: migrations 0034–0044 rewritten to the tradeshow schema.
create or replace function tradeshow.exhibitor_shipment_stats(
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
  from tradeshow.shipments s
  where s.exhibitor_id is not null
    and (p_from is null or s.pickup_date >= p_from)
    and (p_to is null or s.pickup_date <= p_to)
  group by s.exhibitor_id;
$$;

create or replace function tradeshow.carrier_shipment_stats(
  p_from date default null,
  p_to date default null
)
returns table(carrier_id uuid, shipment_count bigint)
language sql
stable
security invoker
as $$
  select s.carrier_id, count(*)::bigint
  from tradeshow.shipments s
  where s.carrier_id is not null
    and (p_from is null or s.pickup_date >= p_from)
    and (p_to is null or s.pickup_date <= p_to)
  group by s.carrier_id;
$$;

create or replace function tradeshow.venue_shipment_stats()
returns table(venue_id uuid, load_count bigint)
language sql
stable
security invoker
as $$
  select s.venue_id, count(*)::bigint
  from tradeshow.shipments s
  where s.venue_id is not null
  group by s.venue_id;
$$;

grant execute on function tradeshow.exhibitor_shipment_stats(date, date) to anon, authenticated, service_role;
grant execute on function tradeshow.carrier_shipment_stats(date, date) to anon, authenticated, service_role;
grant execute on function tradeshow.venue_shipment_stats() to anon, authenticated, service_role;

alter table tradeshow.exhibitors
  add column if not exists owner_rep             text,
  add column if not exists sales_status          text,
  add column if not exists priority_tier         text,
  add column if not exists priority_tier_label   text,
  add column if not exists website               text,
  add column if not exists source                text not null default 'manual',
  add column if not exists ttm_loads             integer,
  add column if not exists ttm_margin            numeric,
  add column if not exists last_pickup           date,
  add column if not exists legacy_loads          integer,
  add column if not exists legacy_first_year     integer,
  add column if not exists legacy_last_year      integer,
  add column if not exists legacy_billed         numeric,
  add column if not exists legacy_margin         numeric,
  add column if not exists legacy_margin_per_load numeric,
  add column if not exists shows_shipped         text,
  add column if not exists shows_confirmed_2026  text,
  add column if not exists top_show_cities       text,
  add column if not exists imported_at           timestamptz;

create index if not exists exhibitors_sales_status_idx  on tradeshow.exhibitors (sales_status);
create index if not exists exhibitors_priority_tier_idx on tradeshow.exhibitors (priority_tier);
create index if not exists exhibitors_owner_rep_idx     on tradeshow.exhibitors (owner_rep);
create index if not exists exhibitors_company_name_lower_idx
  on tradeshow.exhibitors (lower(company_name));

create table if not exists tradeshow.exhibitor_show_history (
  id             uuid primary key default gen_random_uuid(),
  exhibitor_id   uuid not null references tradeshow.exhibitors(id) on delete cascade,
  show_name      text not null,
  show_loads     integer,
  first_year     integer,
  last_year      integer,
  billed         numeric,
  margin         numeric,
  confirmed_2026 text,
  created_at     timestamptz not null default now(),
  unique (exhibitor_id, show_name)
);

create index if not exists exhibitor_show_history_exhibitor_idx
  on tradeshow.exhibitor_show_history (exhibitor_id);

alter table tradeshow.exhibitor_show_history enable row level security;

create policy "exhibitor_show_history: all (authenticated)"
  on tradeshow.exhibitor_show_history for all to authenticated using (true) with check (true);

alter table tradeshow.exhibitor_show_history
  add column if not exists canonical_show_name text;

with counts as (
  select show_name, count(*) c,
         regexp_replace(lower(show_name), '[^a-z0-9]', '', 'g') as norm
  from tradeshow.exhibitor_show_history
  group by show_name
),
anchors as (
  select show_name as anchor, norm from counts where c >= 5 and length(norm) >= 5
)
update tradeshow.exhibitor_show_history h
set canonical_show_name = coalesce(
  (select a.anchor from anchors a
     where regexp_replace(lower(h.show_name), '[^a-z0-9]', '', 'g') like '%' || a.norm || '%'
     order by length(a.norm) desc
     limit 1),
  h.show_name);

create index if not exists exhibitor_show_history_canonical_idx
  on tradeshow.exhibitor_show_history (canonical_show_name);

create table if not exists tradeshow.exhibitor_show_roster (
  id           uuid primary key default gen_random_uuid(),
  show_name    text not null,
  year         int  not null default 2026,
  exhibitor_id uuid not null references tradeshow.exhibitors(id) on delete cascade,
  source       text not null default 'roster_upload',
  created_at   timestamptz not null default now(),
  unique (show_name, year, exhibitor_id)
);

create index if not exists exhibitor_show_roster_show_idx on tradeshow.exhibitor_show_roster (show_name, year);
create index if not exists exhibitor_show_roster_exhibitor_idx on tradeshow.exhibitor_show_roster (exhibitor_id);

alter table tradeshow.exhibitor_show_roster enable row level security;
create policy "exhibitor_show_roster: all (authenticated)"
  on tradeshow.exhibitor_show_roster for all to authenticated using (true) with check (true);

create or replace view tradeshow.show_history_summary
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
from tradeshow.exhibitor_show_history h
left join (
  select show_name, count(*)::int as roster_count
  from tradeshow.exhibitor_show_roster
  where year = 2026
  group by show_name
) r on r.show_name = h.canonical_show_name
group by h.canonical_show_name, r.roster_count;

grant select on tradeshow.show_history_summary to authenticated, service_role;

create table if not exists tradeshow.customers (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null,
  external_id  text,
  owner_rep    text,
  city         text,
  state        text,
  status       text,
  notes        text,
  source       text not null default 'customer_master',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists customers_company_name_lower_idx on tradeshow.customers (lower(company_name));
create index if not exists customers_external_id_idx on tradeshow.customers (external_id);

alter table tradeshow.customers enable row level security;
create policy "customers: all (authenticated)"
  on tradeshow.customers for all to authenticated using (true) with check (true);

alter table tradeshow.customers
  add column if not exists phone    text,
  add column if not exists fax      text,
  add column if not exists address  text,
  add column if not exists address2 text,
  add column if not exists zip      text;

alter table tradeshow.exhibitors
  add column if not exists status_reason text;

create index if not exists exhibitors_status_reason_idx on tradeshow.exhibitors (status_reason);

alter table tradeshow.shipments
  add column if not exists move_out_manual boolean not null default false;

alter table tradeshow.shipments
  add column if not exists cancelled_at timestamptz;

create index if not exists shipments_cancelled_at_idx on tradeshow.shipments (cancelled_at);
