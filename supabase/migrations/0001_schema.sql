-- =============================================================================
-- DTS Trade Show CRM — 0001 Schema
-- Tables, enums, foreign keys, indexes, updated_at triggers, show-status logic.
-- Run this FIRST, then 0002_rls.sql, then 0003_storage.sql.
-- =============================================================================

-- gen_random_uuid() is available by default on Supabase (pgcrypto).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role           as enum ('admin', 'standard');
create type public.shipment_destination as enum ('advance_warehouse', 'direct_to_show');
create type public.shipment_mode        as enum ('LTL', 'FTL', 'partial', 'expedited', 'specialized');
create type public.shipment_status      as enum ('quoted', 'booked', 'in_transit', 'delivered', 'issue');
create type public.tms_sync_status      as enum ('synced', 'manual', 'pending', 'error');
create type public.contact_type         as enum ('gsc_rep', 'venue_coordinator', 'exhibitor_contact', 'carrier_rep', 'other');
create type public.document_type        as enum ('exhibitor_kit', 'routing_guide', 'floor_map', 'advance_warehouse_form', 'other');
create type public.task_status          as enum ('open', 'in_progress', 'completed');
create type public.task_priority        as enum ('low', 'medium', 'high');
create type public.show_status          as enum ('upcoming', 'active', 'completed', 'archived');

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PROFILES  (1:1 with auth.users — internal app users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  role        public.user_role not null default 'standard',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Convenience: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- VENUES
-- ---------------------------------------------------------------------------
create table public.venues (
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
  before update on public.venues
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CARRIERS
-- ---------------------------------------------------------------------------
create table public.carriers (
  id                 uuid primary key default gen_random_uuid(),
  carrier_name       text not null,
  trade_show_notes   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_carriers_updated_at
  before update on public.carriers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- EXHIBITORS
-- ---------------------------------------------------------------------------
create table public.exhibitors (
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
  before update on public.exhibitors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SHOWS
--   gsc_contact_id FK is added AFTER contacts exists (circular reference).
--   `archived` is the manual override; live status is computed (see view below).
-- ---------------------------------------------------------------------------
create table public.shows (
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
  gsc_contact_id            uuid,          -- FK added in 0001 after contacts
  competitor_notes          text,
  general_notes             text,
  venue_id                  uuid references public.venues (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger trg_shows_updated_at
  before update on public.shows
  for each row execute function public.set_updated_at();

create index idx_shows_venue_id on public.shows (venue_id);

-- Computed show status. STABLE because it reads current_date.
-- archived override wins; otherwise the show is "active" from advance-warehouse
-- open (or move-in if no advance date) through move-out, "completed" after
-- move-out, "upcoming" before it begins.
create or replace function public.show_status(s public.shows)
returns public.show_status
language sql
stable
as $$
  select case
    when s.archived then 'archived'::public.show_status
    when s.move_out_end is not null and current_date > s.move_out_end
      then 'completed'::public.show_status
    when current_date >= coalesce(s.advance_warehouse_open, s.move_in_start)
         and current_date <= coalesce(s.move_out_end, s.move_in_end, s.move_in_start)
      then 'active'::public.show_status
    else 'upcoming'::public.show_status
  end;
$$;

-- View that exposes every show column plus the live computed status.
create or replace view public.shows_with_status as
  select s.*, public.show_status(s) as status
  from public.shows s;

-- ---------------------------------------------------------------------------
-- CONTACTS  (attachable to any object; all parent FKs nullable)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  first_name    text,
  last_name     text,
  title         text,
  company       text,
  email         text,
  phone         text,
  contact_type  public.contact_type,
  notes         text,
  show_id       uuid references public.shows (id)      on delete set null,
  exhibitor_id  uuid references public.exhibitors (id) on delete set null,
  venue_id      uuid references public.venues (id)     on delete set null,
  carrier_id    uuid references public.carriers (id)   on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create index idx_contacts_show_id     on public.contacts (show_id);
create index idx_contacts_exhibitor   on public.contacts (exhibitor_id);
create index idx_contacts_venue_id    on public.contacts (venue_id);
create index idx_contacts_carrier_id  on public.contacts (carrier_id);

-- Now wire up the deferred FK from shows -> contacts (primary GSC contact).
alter table public.shows
  add constraint shows_gsc_contact_id_fkey
  foreign key (gsc_contact_id) references public.contacts (id) on delete set null;

create index idx_shows_gsc_contact_id on public.shows (gsc_contact_id);

-- ---------------------------------------------------------------------------
-- SHOW_EXHIBITORS  (junction: which exhibitors are at which show)
-- ---------------------------------------------------------------------------
create table public.show_exhibitors (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid not null references public.shows (id)      on delete cascade,
  exhibitor_id  uuid not null references public.exhibitors (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (show_id, exhibitor_id)
);

create index idx_show_exhibitors_show      on public.show_exhibitors (show_id);
create index idx_show_exhibitors_exhibitor on public.show_exhibitors (exhibitor_id);

-- ---------------------------------------------------------------------------
-- SHIPMENTS
-- ---------------------------------------------------------------------------
create table public.shipments (
  id                      uuid primary key default gen_random_uuid(),
  show_id                 uuid references public.shows (id)      on delete set null,
  exhibitor_id            uuid references public.exhibitors (id) on delete set null,
  carrier_id              uuid references public.carriers (id)   on delete set null,
  origin_street           text,
  origin_city             text,
  origin_state            text,
  origin_zip              text,
  destination_type        public.shipment_destination,
  pieces                  integer,
  weight                  numeric(12,2),
  mode                    public.shipment_mode,
  special_requirements    text,
  pro_number              text,
  pickup_date             date,
  estimated_delivery_date date,
  actual_delivery_date    date,
  status                  public.shipment_status not null default 'quoted',
  accessorials_flagged    boolean not null default false,
  notes                   text,
  -- TMS / BrokerWareLite integration (phase two, schema-ready now)
  tms_reference_id        text unique,
  tms_sync_status         public.tms_sync_status not null default 'manual',
  tms_last_synced_at      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_shipments_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

create index idx_shipments_show_id      on public.shipments (show_id);
create index idx_shipments_exhibitor_id on public.shipments (exhibitor_id);
create index idx_shipments_carrier_id   on public.shipments (carrier_id);
create index idx_shipments_status       on public.shipments (status);
create index idx_shipments_mode         on public.shipments (mode);
-- tms_reference_id already has a unique index from the UNIQUE constraint.

-- ---------------------------------------------------------------------------
-- DOCUMENTS  (files attached to a show, stored in the `documents` bucket)
-- ---------------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  document_name text not null,
  document_type public.document_type,
  show_id       uuid not null references public.shows (id) on delete cascade,
  file_url      text,           -- storage object path within the bucket
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid references public.profiles (id) on delete set null
);

create index idx_documents_show_id on public.documents (show_id);

-- ---------------------------------------------------------------------------
-- SHOW_DEBRIEFS  (post-show retrospective; one or more per show)
-- ---------------------------------------------------------------------------
create table public.show_debriefs (
  id                        uuid primary key default gen_random_uuid(),
  show_id                   uuid not null references public.shows (id) on delete cascade,
  what_went_well            text,
  what_went_wrong           text,
  carrier_performance_notes text,
  venue_issues              text,
  recommendations_next_year text,
  logged_by                 uuid references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now()
);

create index idx_show_debriefs_show_id on public.show_debriefs (show_id);

-- ---------------------------------------------------------------------------
-- CARRIER_VENUES  (junction: which carriers service which venues)
-- ---------------------------------------------------------------------------
create table public.carrier_venues (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references public.carriers (id) on delete cascade,
  venue_id    uuid not null references public.venues (id)   on delete cascade,
  unique (carrier_id, venue_id)
);

create index idx_carrier_venues_carrier on public.carrier_venues (carrier_id);
create index idx_carrier_venues_venue    on public.carrier_venues (venue_id);

-- ---------------------------------------------------------------------------
-- TASKS  (attachable to any related record)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  description          text,
  due_date             date,
  assigned_to          uuid references public.profiles (id)   on delete set null,
  status               public.task_status   not null default 'open',
  priority             public.task_priority not null default 'medium',
  related_show_id      uuid references public.shows (id)      on delete cascade,
  related_exhibitor_id uuid references public.exhibitors (id) on delete cascade,
  related_shipment_id  uuid references public.shipments (id)  on delete cascade,
  related_carrier_id   uuid references public.carriers (id)   on delete cascade,
  related_venue_id     uuid references public.venues (id)     on delete cascade,
  created_by           uuid references public.profiles (id)   on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create index idx_tasks_assigned_to    on public.tasks (assigned_to);
create index idx_tasks_status         on public.tasks (status);
create index idx_tasks_due_date       on public.tasks (due_date);
create index idx_tasks_related_show   on public.tasks (related_show_id);
create index idx_tasks_related_exhib  on public.tasks (related_exhibitor_id);
create index idx_tasks_related_ship   on public.tasks (related_shipment_id);
create index idx_tasks_related_carrier on public.tasks (related_carrier_id);
create index idx_tasks_related_venue  on public.tasks (related_venue_id);
