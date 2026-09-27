-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260828020937 "tradeshow_crm_part1_core".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- DTS Trade Show CRM — full structure in the `tradeshow` schema (part 1/3: 0001–0004).
create schema if not exists tradeshow;
grant usage on schema tradeshow to anon, authenticated, service_role;

create type tradeshow.user_role           as enum ('admin', 'standard');
create type tradeshow.shipment_destination as enum ('advance_warehouse', 'direct_to_show');
create type tradeshow.shipment_mode        as enum ('LTL', 'FTL', 'partial', 'expedited', 'specialized');
create type tradeshow.shipment_status      as enum ('quoted', 'booked', 'in_transit', 'delivered', 'issue');
create type tradeshow.tms_sync_status      as enum ('synced', 'manual', 'pending', 'error');
create type tradeshow.contact_type         as enum ('gsc_rep', 'venue_coordinator', 'exhibitor_contact', 'carrier_rep', 'other');
create type tradeshow.document_type        as enum ('exhibitor_kit', 'routing_guide', 'floor_map', 'advance_warehouse_form', 'other');
create type tradeshow.task_status          as enum ('open', 'in_progress', 'completed');
create type tradeshow.task_priority        as enum ('low', 'medium', 'high');
create type tradeshow.show_status          as enum ('upcoming', 'active', 'completed', 'archived');

create or replace function tradeshow.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table tradeshow.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  role        tradeshow.user_role not null default 'standard',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on tradeshow.profiles
  for each row execute function tradeshow.set_updated_at();

create or replace function tradeshow.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = tradeshow
as $$
begin
  insert into tradeshow.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created_tradeshow
  after insert on auth.users
  for each row execute function tradeshow.handle_new_user();

create or replace function tradeshow.is_admin()
returns boolean
language sql
stable
security definer
set search_path = tradeshow
as $$
  select exists (
    select 1 from tradeshow.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table tradeshow.venues (
  id                        uuid primary key default gen_random_uuid(),
  venue_name                text not null,
  city                      text,
  state                     text,
  address                   text,
  dock_notes                text,
  union_rules               text,
  delivery_restrictions     text,
  parking_and_staging_notes text,
  general_notes             text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger trg_venues_updated_at
  before update on tradeshow.venues
  for each row execute function tradeshow.set_updated_at();

create table tradeshow.carriers (
  id                 uuid primary key default gen_random_uuid(),
  carrier_name       text not null,
  trade_show_notes   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_carriers_updated_at
  before update on tradeshow.carriers
  for each row execute function tradeshow.set_updated_at();

create table tradeshow.exhibitors (
  id                    uuid primary key default gen_random_uuid(),
  company_name          text not null,
  industry              text,
  primary_contact_name  text,
  primary_contact_title text,
  primary_contact_email text,
  primary_contact_phone text,
  secondary_contacts    jsonb not null default '[]'::jsonb,
  freight_profile_notes text,
  general_notes         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_exhibitors_updated_at
  before update on tradeshow.exhibitors
  for each row execute function tradeshow.set_updated_at();

create table tradeshow.shows (
  id                        uuid primary key default gen_random_uuid(),
  show_name                 text not null,
  edition_year              integer,
  industry_vertical         text,
  show_management_company   text,
  archived                  boolean not null default false,
  move_in_start             date,
  move_in_end               date,
  move_out_start            date,
  move_out_end              date,
  advance_warehouse_open    date,
  advance_warehouse_cutoff  date,
  direct_to_show_start      date,
  direct_to_show_end        date,
  estimated_revenue         numeric(14,2),
  actual_revenue            numeric(14,2),
  gsc_contact_id            uuid,
  competitor_notes          text,
  general_notes             text,
  venue_id                  uuid references tradeshow.venues (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger trg_shows_updated_at
  before update on tradeshow.shows
  for each row execute function tradeshow.set_updated_at();

create index idx_shows_venue_id on tradeshow.shows (venue_id);

create or replace function tradeshow.show_status(s tradeshow.shows)
returns tradeshow.show_status
language sql
stable
as $$
  select case
    when s.archived then 'archived'::tradeshow.show_status
    when s.move_out_end is not null and current_date > s.move_out_end
      then 'completed'::tradeshow.show_status
    when current_date >= coalesce(s.advance_warehouse_open, s.move_in_start)
         and current_date <= coalesce(s.move_out_end, s.move_in_end, s.move_in_start)
      then 'active'::tradeshow.show_status
    else 'upcoming'::tradeshow.show_status
  end;
$$;

create or replace view tradeshow.shows_with_status as
  select s.*, tradeshow.show_status(s) as status
  from tradeshow.shows s;

create table tradeshow.contacts (
  id            uuid primary key default gen_random_uuid(),
  first_name    text,
  last_name     text,
  title         text,
  company       text,
  email         text,
  phone         text,
  contact_type  tradeshow.contact_type,
  notes         text,
  show_id       uuid references tradeshow.shows (id)      on delete set null,
  exhibitor_id  uuid references tradeshow.exhibitors (id) on delete set null,
  venue_id      uuid references tradeshow.venues (id)     on delete set null,
  carrier_id    uuid references tradeshow.carriers (id)   on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_contacts_updated_at
  before update on tradeshow.contacts
  for each row execute function tradeshow.set_updated_at();

create index idx_contacts_show_id     on tradeshow.contacts (show_id);
create index idx_contacts_exhibitor   on tradeshow.contacts (exhibitor_id);
create index idx_contacts_venue_id    on tradeshow.contacts (venue_id);
create index idx_contacts_carrier_id  on tradeshow.contacts (carrier_id);

alter table tradeshow.shows
  add constraint shows_gsc_contact_id_fkey
  foreign key (gsc_contact_id) references tradeshow.contacts (id) on delete set null;

create index idx_shows_gsc_contact_id on tradeshow.shows (gsc_contact_id);

create table tradeshow.show_exhibitors (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid not null references tradeshow.shows (id)      on delete cascade,
  exhibitor_id  uuid not null references tradeshow.exhibitors (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (show_id, exhibitor_id)
);

create index idx_show_exhibitors_show      on tradeshow.show_exhibitors (show_id);
create index idx_show_exhibitors_exhibitor on tradeshow.show_exhibitors (exhibitor_id);

create table tradeshow.shipments (
  id                      uuid primary key default gen_random_uuid(),
  show_id                 uuid references tradeshow.shows (id)      on delete set null,
  exhibitor_id            uuid references tradeshow.exhibitors (id) on delete set null,
  carrier_id              uuid references tradeshow.carriers (id)   on delete set null,
  origin_street           text,
  origin_city             text,
  origin_state            text,
  origin_zip              text,
  destination_type        tradeshow.shipment_destination,
  pieces                  integer,
  weight                  numeric(12,2),
  mode                    tradeshow.shipment_mode,
  special_requirements    text,
  pro_number              text,
  pickup_date             date,
  estimated_delivery_date date,
  actual_delivery_date    date,
  status                  tradeshow.shipment_status not null default 'quoted',
  accessorials_flagged    boolean not null default false,
  notes                   text,
  tms_reference_id        text unique,
  tms_sync_status         tradeshow.tms_sync_status not null default 'manual',
  tms_last_synced_at      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_shipments_updated_at
  before update on tradeshow.shipments
  for each row execute function tradeshow.set_updated_at();

create index idx_shipments_show_id      on tradeshow.shipments (show_id);
create index idx_shipments_exhibitor_id on tradeshow.shipments (exhibitor_id);
create index idx_shipments_carrier_id   on tradeshow.shipments (carrier_id);
create index idx_shipments_status       on tradeshow.shipments (status);
create index idx_shipments_mode         on tradeshow.shipments (mode);

create table tradeshow.documents (
  id            uuid primary key default gen_random_uuid(),
  document_name text not null,
  document_type tradeshow.document_type,
  show_id       uuid not null references tradeshow.shows (id) on delete cascade,
  file_url      text,
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid references tradeshow.profiles (id) on delete set null
);

create index idx_documents_show_id on tradeshow.documents (show_id);

create table tradeshow.show_debriefs (
  id                        uuid primary key default gen_random_uuid(),
  show_id                   uuid not null references tradeshow.shows (id) on delete cascade,
  what_went_well            text,
  what_went_wrong           text,
  carrier_performance_notes text,
  venue_issues              text,
  recommendations_next_year text,
  logged_by                 uuid references tradeshow.profiles (id) on delete set null,
  created_at                timestamptz not null default now()
);

create index idx_show_debriefs_show_id on tradeshow.show_debriefs (show_id);

create table tradeshow.carrier_venues (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references tradeshow.carriers (id) on delete cascade,
  venue_id    uuid not null references tradeshow.venues (id)   on delete cascade,
  unique (carrier_id, venue_id)
);

create index idx_carrier_venues_carrier on tradeshow.carrier_venues (carrier_id);
create index idx_carrier_venues_venue    on tradeshow.carrier_venues (venue_id);

create table tradeshow.tasks (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  description          text,
  due_date             date,
  assigned_to          uuid references tradeshow.profiles (id)   on delete set null,
  status               tradeshow.task_status   not null default 'open',
  priority             tradeshow.task_priority not null default 'medium',
  related_show_id      uuid references tradeshow.shows (id)      on delete cascade,
  related_exhibitor_id uuid references tradeshow.exhibitors (id) on delete cascade,
  related_shipment_id  uuid references tradeshow.shipments (id)  on delete cascade,
  related_carrier_id   uuid references tradeshow.carriers (id)   on delete cascade,
  related_venue_id     uuid references tradeshow.venues (id)     on delete cascade,
  created_by           uuid references tradeshow.profiles (id)   on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_tasks_updated_at
  before update on tradeshow.tasks
  for each row execute function tradeshow.set_updated_at();

create index idx_tasks_assigned_to    on tradeshow.tasks (assigned_to);
create index idx_tasks_status         on tradeshow.tasks (status);
create index idx_tasks_due_date       on tradeshow.tasks (due_date);
create index idx_tasks_related_show   on tradeshow.tasks (related_show_id);
create index idx_tasks_related_exhib  on tradeshow.tasks (related_exhibitor_id);
create index idx_tasks_related_ship   on tradeshow.tasks (related_shipment_id);
create index idx_tasks_related_carrier on tradeshow.tasks (related_carrier_id);
create index idx_tasks_related_venue  on tradeshow.tasks (related_venue_id);

alter view tradeshow.shows_with_status set (security_invoker = true);

alter table tradeshow.profiles        enable row level security;
alter table tradeshow.venues          enable row level security;
alter table tradeshow.carriers        enable row level security;
alter table tradeshow.exhibitors      enable row level security;
alter table tradeshow.shows           enable row level security;
alter table tradeshow.contacts       enable row level security;
alter table tradeshow.show_exhibitors enable row level security;
alter table tradeshow.shipments       enable row level security;
alter table tradeshow.documents       enable row level security;
alter table tradeshow.show_debriefs   enable row level security;
alter table tradeshow.carrier_venues  enable row level security;
alter table tradeshow.tasks           enable row level security;

create policy "profiles: read all (authenticated)"
  on tradeshow.profiles for select to authenticated using (true);

create policy "profiles: update own"
  on tradeshow.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: admin update any"
  on tradeshow.profiles for update to authenticated
  using (tradeshow.is_admin()) with check (tradeshow.is_admin());

create or replace function tradeshow.enforce_role_change()
returns trigger
language plpgsql
security definer
set search_path = tradeshow
as $$
begin
  if new.role is distinct from old.role and not tradeshow.is_admin() then
    raise exception 'Only admins can change a user role';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_enforce_role
  before update on tradeshow.profiles
  for each row execute function tradeshow.enforce_role_change();

create policy "venues: all (authenticated)"
  on tradeshow.venues for all to authenticated using (true) with check (true);

create policy "carriers: all (authenticated)"
  on tradeshow.carriers for all to authenticated using (true) with check (true);

create policy "exhibitors: all (authenticated)"
  on tradeshow.exhibitors for all to authenticated using (true) with check (true);

create policy "shows: all (authenticated)"
  on tradeshow.shows for all to authenticated using (true) with check (true);

create policy "contacts: all (authenticated)"
  on tradeshow.contacts for all to authenticated using (true) with check (true);

create policy "show_exhibitors: all (authenticated)"
  on tradeshow.show_exhibitors for all to authenticated using (true) with check (true);

create policy "shipments: all (authenticated)"
  on tradeshow.shipments for all to authenticated using (true) with check (true);

create policy "documents: all (authenticated)"
  on tradeshow.documents for all to authenticated using (true) with check (true);

create policy "show_debriefs: all (authenticated)"
  on tradeshow.show_debriefs for all to authenticated using (true) with check (true);

create policy "carrier_venues: all (authenticated)"
  on tradeshow.carrier_venues for all to authenticated using (true) with check (true);

create policy "tasks: all (authenticated)"
  on tradeshow.tasks for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "tradeshow: documents bucket: read (authenticated)"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents');

create policy "tradeshow: documents bucket: insert (authenticated)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

create policy "tradeshow: documents bucket: update (authenticated)"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents') with check (bucket_id = 'documents');

create policy "tradeshow: documents bucket: delete (authenticated)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents');

grant usage on schema tradeshow to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema tradeshow
  to authenticated;

grant select, insert, update, delete
  on all tables in schema tradeshow
  to service_role;

grant select on tradeshow.shows_with_status to authenticated, service_role;

alter default privileges in schema tradeshow
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema tradeshow
  grant select, insert, update, delete on tables to service_role;
