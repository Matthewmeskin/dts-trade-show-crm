-- DTS Trade Show CRM — full structure in the `tradeshow` schema.
-- Generated from migrations 0001–0044 for coexistence with other apps in `public`.
create schema if not exists tradeshow;
grant usage on schema tradeshow to anon, authenticated, service_role;

-- ===== from 0001_schema.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0001 Schema
-- Tables, enums, foreign keys, indexes, updated_at triggers, show-status logic.
-- Run this FIRST, then 0002_rls.sql, then 0003_storage.sql.
-- =============================================================================

-- gen_random_uuid() is available by default on Supabase (pgcrypto).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function tradeshow.set_updated_at()
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

-- Auto-create a profile row whenever a new auth user is created.
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

-- Convenience: is the current user an admin?
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

-- ---------------------------------------------------------------------------
-- VENUES
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- CARRIERS
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- EXHIBITORS
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SHOWS
--   gsc_contact_id FK is added AFTER contacts exists (circular reference).
--   `archived` is the manual override; live status is computed (see view below).
-- ---------------------------------------------------------------------------
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
  gsc_contact_id            uuid,          -- FK added in 0001 after contacts
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

-- Computed show status. STABLE because it reads current_date.
-- archived override wins; otherwise the show is "active" from advance-warehouse
-- open (or move-in if no advance date) through move-out, "completed" after
-- move-out, "upcoming" before it begins.
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

-- View that exposes every show column plus the live computed status.
create or replace view tradeshow.shows_with_status as
  select s.*, tradeshow.show_status(s) as status
  from tradeshow.shows s;

-- ---------------------------------------------------------------------------
-- CONTACTS  (attachable to any object; all parent FKs nullable)
-- ---------------------------------------------------------------------------
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

-- Now wire up the deferred FK from shows -> contacts (primary GSC contact).
alter table tradeshow.shows
  add constraint shows_gsc_contact_id_fkey
  foreign key (gsc_contact_id) references tradeshow.contacts (id) on delete set null;

create index idx_shows_gsc_contact_id on tradeshow.shows (gsc_contact_id);

-- ---------------------------------------------------------------------------
-- SHOW_EXHIBITORS  (junction: which exhibitors are at which show)
-- ---------------------------------------------------------------------------
create table tradeshow.show_exhibitors (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid not null references tradeshow.shows (id)      on delete cascade,
  exhibitor_id  uuid not null references tradeshow.exhibitors (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (show_id, exhibitor_id)
);

create index idx_show_exhibitors_show      on tradeshow.show_exhibitors (show_id);
create index idx_show_exhibitors_exhibitor on tradeshow.show_exhibitors (exhibitor_id);

-- ---------------------------------------------------------------------------
-- SHIPMENTS
-- ---------------------------------------------------------------------------
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
  -- TMS / BrokerWareLite integration (phase two, schema-ready now)
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
-- tms_reference_id already has a unique index from the UNIQUE constraint.

-- ---------------------------------------------------------------------------
-- DOCUMENTS  (files attached to a show, stored in the `documents` bucket)
-- ---------------------------------------------------------------------------
create table tradeshow.documents (
  id            uuid primary key default gen_random_uuid(),
  document_name text not null,
  document_type tradeshow.document_type,
  show_id       uuid not null references tradeshow.shows (id) on delete cascade,
  file_url      text,           -- storage object path within the bucket
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid references tradeshow.profiles (id) on delete set null
);

create index idx_documents_show_id on tradeshow.documents (show_id);

-- ---------------------------------------------------------------------------
-- SHOW_DEBRIEFS  (post-show retrospective; one or more per show)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- CARRIER_VENUES  (junction: which carriers service which venues)
-- ---------------------------------------------------------------------------
create table tradeshow.carrier_venues (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references tradeshow.carriers (id) on delete cascade,
  venue_id    uuid not null references tradeshow.venues (id)   on delete cascade,
  unique (carrier_id, venue_id)
);

create index idx_carrier_venues_carrier on tradeshow.carrier_venues (carrier_id);
create index idx_carrier_venues_venue    on tradeshow.carrier_venues (venue_id);

-- ---------------------------------------------------------------------------
-- TASKS  (attachable to any related record)
-- ---------------------------------------------------------------------------
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

-- ===== from 0002_rls.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0002 Row Level Security
-- Internal multi-user model: every authenticated (logged-in) user has full
-- read/write access to the business tables. profiles are readable by all,
-- self-editable, and protected against role self-escalation. anon has no access.
-- Run AFTER 0001_schema.sql.
-- =============================================================================

-- Make the status view respect the querying user's RLS on `shows`
-- (Postgres 15+ / Supabase). Without this the view would run as its owner.
alter view tradeshow.shows_with_status set (security_invoker = true);

-- Helper: apply a full-access authenticated policy to a business table.
-- (Written out explicitly per-table below for clarity / auditability.)

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table tradeshow.profiles        enable row level security;
alter table tradeshow.venues          enable row level security;
alter table tradeshow.carriers        enable row level security;
alter table tradeshow.exhibitors      enable row level security;
alter table tradeshow.shows           enable row level security;
alter table tradeshow.contacts        enable row level security;
alter table tradeshow.show_exhibitors enable row level security;
alter table tradeshow.shipments       enable row level security;
alter table tradeshow.documents       enable row level security;
alter table tradeshow.show_debriefs   enable row level security;
alter table tradeshow.carrier_venues  enable row level security;
alter table tradeshow.tasks           enable row level security;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create policy "profiles: read all (authenticated)"
  on tradeshow.profiles for select to authenticated using (true);

create policy "profiles: update own"
  on tradeshow.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: admin update any"
  on tradeshow.profiles for update to authenticated
  using (tradeshow.is_admin()) with check (tradeshow.is_admin());

-- Prevent a non-admin from changing their own role (privilege escalation).
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

-- ---------------------------------------------------------------------------
-- Business tables — full access for any authenticated user.
-- ---------------------------------------------------------------------------
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

-- ===== from 0003_storage.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0003 Storage
-- Private `documents` bucket for show files (exhibitor kits, routing guides,
-- floor maps, advance-warehouse forms, etc). Access via the app using
-- authenticated requests / signed URLs. Run AFTER 0002_rls.sql.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Authenticated users can read, upload, update, and delete objects in the
-- `documents` bucket. anon users get nothing.
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

-- ===== from 0004_grants.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0004 Role grants
-- PostgREST checks table-level privileges BEFORE evaluating RLS. This Supabase
-- project did not auto-grant DML on the public tables to the API roles, so
-- without this every authenticated request 401s ("permission denied for
-- table ..."). RLS still governs which ROWS each user can see/change; these
-- grants just open the gate so RLS can run. anon intentionally gets no DML.
-- Run AFTER 0003_storage.sql.
-- =============================================================================

grant usage on schema tradeshow to anon, authenticated, service_role;

-- authenticated: full DML on business data; RLS policies (0002) narrow it.
grant select, insert, update, delete
  on all tables in schema tradeshow
  to authenticated;

-- service_role: trusted server-side use (e.g. the phase-two n8n/TMS endpoint).
-- Bypasses RLS but still needs table grants.
grant select, insert, update, delete
  on all tables in schema tradeshow
  to service_role;

-- The status view (security_invoker) — covered by ALL TABLES above, kept
-- explicit for clarity.
grant select on tradeshow.shows_with_status to authenticated, service_role;

-- Ensure tables created by future migrations inherit the same grants.
alter default privileges in schema tradeshow
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema tradeshow
  grant select, insert, update, delete on tables to service_role;

-- ===== from 0005_show_dates.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0005 Actual show dates
-- The existing date columns are all FREIGHT dates (advance warehouse, move-in,
-- move-out, direct-to-show). Add the actual show run — the days the show is
-- open to attendees — which is distinct from the freight logistics window.
-- =============================================================================

alter table tradeshow.shows
  add column if not exists show_start_date date,
  add column if not exists show_end_date date;

-- shows_with_status is `select s.*, ...`, whose * was expanded at creation time,
-- so it doesn't pick up the new columns automatically. Recreate it. (CREATE OR
-- REPLACE can't insert columns before the trailing `status` column, so drop +
-- create, then re-apply security_invoker and grants.)
drop view if exists tradeshow.shows_with_status;
create view tradeshow.shows_with_status as
  select s.*, tradeshow.show_status(s) as status
  from tradeshow.shows s;
alter view tradeshow.shows_with_status set (security_invoker = true);
grant select on tradeshow.shows_with_status to authenticated, service_role;

-- ===== from 0006_shipment_package_tracking.sql =====
-- Freight detail fields populated from Hyperion Global Tracking:
--   package_type  <- packaging      (e.g. "Bundles", "Pallets", "FTL")
--   tracking_url  <- carrierTrackingURL (carrier's external tracking page)
alter table tradeshow.shipments
  add column if not exists package_type text,
  add column if not exists tracking_url text;

-- ===== from 0007_shipment_destination_address.sql =====
-- Delivery address from Hyperion Global Tracking (deliveryLocation), shown as
-- the shipment's Destination — symmetric with the parsed Origin address.
alter table tradeshow.shipments
  add column if not exists destination_address text;

-- ===== from 0008_tms_load_candidates.sql =====
-- Candidates surfaced by the AI Load Finder: TMS loads that look like
-- trade-show freight, pending operator review (add / dismiss).
create table if not exists tradeshow.tms_load_candidates (
  id uuid primary key default gen_random_uuid(),
  load_number text not null unique,
  tms_status text,
  mode text,
  pickup_location text,
  delivery_location text,
  carrier_name text,
  pieces integer,
  weight numeric,
  ai_is_candidate boolean not null default false,
  ai_confidence text,
  ai_reason text,
  matched_venue text,
  review_status text not null default 'new',   -- new / dismissed / imported
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tradeshow.tms_load_candidates enable row level security;

drop policy if exists "authenticated read candidates" on tradeshow.tms_load_candidates;
create policy "authenticated read candidates"
  on tradeshow.tms_load_candidates for select to authenticated using (true);

drop policy if exists "authenticated update candidates" on tradeshow.tms_load_candidates;
create policy "authenticated update candidates"
  on tradeshow.tms_load_candidates for update to authenticated using (true) with check (true);

grant select, update on tradeshow.tms_load_candidates to authenticated;
grant all on tradeshow.tms_load_candidates to service_role;

-- ===== from 0009_shipment_financials.sql =====
-- Per-shipment financials and trade-show reference numbers.
--   billed_amount  -- revenue billed to the customer/exhibitor
--   cost_amount    -- carrier cost
--   margin         -- billed - cost, computed (generated column, never written)
--   po_ref         -- exhibitor / show purchase-order reference
--   shipper_number -- shipper's own reference number
-- All operator-owned except `margin`, which Postgres maintains automatically.
alter table tradeshow.shipments
  add column if not exists billed_amount  numeric(12,2),
  add column if not exists cost_amount    numeric(12,2),
  add column if not exists margin         numeric(12,2)
    generated always as (billed_amount - cost_amount) stored,
  add column if not exists po_ref         text,
  add column if not exists shipper_number text;

-- ===== from 0010_load_candidate_customer.sql =====
-- Capture the customer (exhibitor) name from Hyperion GetLoads at scan time.
-- The live tracking feed used on import omits the customer name, so without
-- this the Load Finder can't find-or-create the exhibitor when a candidate is
-- imported. GetLoads carries `customerName` directly, so we record it here.
alter table tradeshow.tms_load_candidates
  add column if not exists customer_name text;

-- ===== from 0011_load_candidate_financials.sql =====
-- Carry GetLoads financials + reference numbers on the candidate so the Load
-- Finder import can seed them onto the shipment (operator-editable thereafter;
-- the live tracking sync never touches these fields).
--   po_ref         <- GetLoads poReference
--   shipper_number <- GetLoads shipperNum
--   billed_amount  <- sum(items[].billed)
--   cost_amount    <- sum(items[].cost)
alter table tradeshow.tms_load_candidates
  add column if not exists po_ref         text,
  add column if not exists shipper_number text,
  add column if not exists billed_amount  numeric(12,2),
  add column if not exists cost_amount    numeric(12,2);

-- ===== from 0012_shipment_venue.sql =====
-- Link a shipment directly to its convention center (venue). On Load Finder
-- import we find-or-create the venue the AI matched and attach it here, so the
-- show site is captured even before the shipment is tied to a show.
alter table tradeshow.shipments
  add column if not exists venue_id uuid references tradeshow.venues (id) on delete set null;

create index if not exists idx_shipments_venue_id on tradeshow.shipments (venue_id);

-- ===== from 0013_shipment_move_in_out.sql =====
-- Move-in / move-out direction, the must-deliver-by target date, and the
-- relevant show date — so the team can see which loads are on track for a
-- move-in (where on-time delivery matters most).
--   direction            move_in (into the show) / move_out (back from it)
--   target_delivery_date  operator deadline; falls back to the show in the app
--   show_date             relevant show date; falls back to the show in the app
do $$
begin
  if not exists (select 1 from pg_type where typname = 'shipment_direction' and typnamespace = 'tradeshow'::regnamespace) then
    create type tradeshow.shipment_direction as enum ('move_in', 'move_out');
  end if;
end $$;

alter table tradeshow.shipments
  add column if not exists direction            tradeshow.shipment_direction,
  add column if not exists target_delivery_date date,
  add column if not exists show_date            date;

create index if not exists idx_shipments_direction on tradeshow.shipments (direction);
create index if not exists idx_shipments_target_delivery_date on tradeshow.shipments (target_delivery_date);

-- ===== from 0014_carrier_shows.sql =====
-- Shows a carrier services — a manual many-to-many like carrier_venues, so the
-- carrier record can list the shows it covers (separate from shipment history).
create table if not exists tradeshow.carrier_shows (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references tradeshow.carriers (id) on delete cascade,
  show_id     uuid not null references tradeshow.shows (id)    on delete cascade,
  unique (carrier_id, show_id)
);

create index if not exists idx_carrier_shows_carrier on tradeshow.carrier_shows (carrier_id);
create index if not exists idx_carrier_shows_show    on tradeshow.carrier_shows (show_id);

alter table tradeshow.carrier_shows enable row level security;

drop policy if exists "carrier_shows: all (authenticated)" on tradeshow.carrier_shows;
create policy "carrier_shows: all (authenticated)"
  on tradeshow.carrier_shows for all to authenticated using (true) with check (true);

grant select, insert, update, delete on tradeshow.carrier_shows to authenticated, service_role;

-- ===== from 0015_show_links.sql =====
-- External reference links for a show: the show's public website, the
-- exhibitor service manual, and the published exhibitor list.
alter table tradeshow.shows
  add column if not exists website_url        text,
  add column if not exists exhibitor_manual_url text,
  add column if not exists exhibitor_list_url   text;

-- ===== from 0016_shipment_tms_customer.sql =====
-- Hyperion customer number for a load, captured from the TMS API alongside the
-- load number (tms_reference_id). Together they form the Hyperion shipment
-- profile URL: /pages/shipments/shipmentprofile/{tms_customer_id}/{tms_reference_id}
alter table tradeshow.shipments
  add column if not exists tms_customer_id text;

-- ===== from 0017_show_freight_addresses.sql =====
-- Physical freight delivery addresses for a show: the advance warehouse
-- (receiving dock) and the direct-to-show / show-site address. Distinct from
-- the show's venue, since the advance warehouse is usually a separate facility.
alter table tradeshow.shows
  add column if not exists advance_warehouse_address text,
  add column if not exists direct_to_show_address   text;

-- ===== from 0018_show_freight_address_parts.sql =====
-- Break the freight delivery addresses into structured parts so a show's
-- advance-warehouse and direct-to-show labels can carry a ship-to/recipient
-- name, a C/O handling agent, and separate street/city/state/zip/country.
-- The existing single-text *_address columns are retained as a composed,
-- human-readable fallback (kept in sync on save) so existing data and the map
-- links keep working.
alter table tradeshow.shows
  add column if not exists advance_warehouse_name      text,
  add column if not exists advance_warehouse_care_of   text,
  add column if not exists advance_warehouse_street1    text,
  add column if not exists advance_warehouse_street2    text,
  add column if not exists advance_warehouse_city       text,
  add column if not exists advance_warehouse_state      text,
  add column if not exists advance_warehouse_zip        text,
  add column if not exists advance_warehouse_country     text,
  add column if not exists direct_to_show_name         text,
  add column if not exists direct_to_show_care_of      text,
  add column if not exists direct_to_show_street1       text,
  add column if not exists direct_to_show_street2       text,
  add column if not exists direct_to_show_city          text,
  add column if not exists direct_to_show_state         text,
  add column if not exists direct_to_show_zip           text,
  add column if not exists direct_to_show_country        text;

-- ===== from 0019_shipment_checkin_and_documents.sql =====
-- Move-out check-in number captured per shipment, and document attachments that
-- can belong to a shipment as well as a show.
alter table tradeshow.shipments
  add column if not exists check_in_number text;

alter table tradeshow.documents
  add column if not exists shipment_id uuid references tradeshow.shipments (id) on delete cascade;

alter table tradeshow.documents alter column show_id drop not null;

create index if not exists idx_documents_shipment_id on tradeshow.documents (shipment_id);

-- A document must belong to a show or a shipment.
alter table tradeshow.documents drop constraint if exists documents_show_or_shipment_chk;
alter table tradeshow.documents
  add constraint documents_show_or_shipment_chk
  check (show_id is not null or shipment_id is not null);

-- ===== from 0020_shipment_consignee_and_booth.sql =====
-- Structured consignee (the load's delivery party / move-out return address)
-- and booth number, captured from the Hyperion load's delivery stop so the
-- outbound move-out form prints fully pre-filled.
alter table tradeshow.shipments
  add column if not exists consignee_company  text,
  add column if not exists consignee_contact  text,
  add column if not exists consignee_phone    text,
  add column if not exists consignee_street1  text,
  add column if not exists consignee_street2  text,
  add column if not exists consignee_city     text,
  add column if not exists consignee_state    text,
  add column if not exists consignee_zip      text,
  add column if not exists consignee_country  text,
  add column if not exists booth_number       text;

-- ===== from 0021_shipment_tms_venue_context.sql =====
-- The trade-show venue context from the Hyperion load's show-side stop (the
-- one carrying the booth / convention venue). Raw text + city/state feed venue
-- and show suggestions and AI discovery; linkage stays in venue_id/show_id.
alter table tradeshow.shipments
  add column if not exists tms_venue_raw   text,
  add column if not exists tms_venue_city  text,
  add column if not exists tms_venue_state text;

-- ===== from 0022_shipment_auto_link_flags.sql =====
-- Track when the TMS sync auto-linked a venue/show (vs a manual link), so the
-- UI can flag auto matches for review.
alter table tradeshow.shipments
  add column if not exists venue_auto_linked boolean not null default false,
  add column if not exists show_auto_linked  boolean not null default false;

-- ===== from 0023_merge_functions.sql =====
-- merge_venues / merge_shows: reassign every reference from a duplicate record
-- to the kept one (dedup junction rows), fill the keeper's empty fields from the
-- duplicate, then delete the duplicate. Used by the Merge tool.

create or replace function tradeshow.merge_venues(p_target uuid, p_source uuid)
returns void language plpgsql security definer set search_path = tradeshow as $$
begin
  if p_target = p_source or p_target is null or p_source is null then return; end if;
  update tradeshow.shows      set venue_id = p_target          where venue_id = p_source;
  update tradeshow.shipments  set venue_id = p_target          where venue_id = p_source;
  update tradeshow.contacts   set venue_id = p_target          where venue_id = p_source;
  update tradeshow.tasks      set related_venue_id = p_target  where related_venue_id = p_source;
  insert into tradeshow.carrier_venues (carrier_id, venue_id)
    select carrier_id, p_target from tradeshow.carrier_venues where venue_id = p_source
    on conflict (carrier_id, venue_id) do nothing;
  delete from tradeshow.carrier_venues where venue_id = p_source;
  update tradeshow.venues t set
    address                   = coalesce(t.address, s.address),
    city                      = coalesce(t.city, s.city),
    state                     = coalesce(t.state, s.state),
    dock_notes                = coalesce(t.dock_notes, s.dock_notes),
    union_rules               = coalesce(t.union_rules, s.union_rules),
    delivery_restrictions     = coalesce(t.delivery_restrictions, s.delivery_restrictions),
    parking_and_staging_notes = coalesce(t.parking_and_staging_notes, s.parking_and_staging_notes),
    general_notes             = coalesce(t.general_notes, s.general_notes)
  from tradeshow.venues s where t.id = p_target and s.id = p_source;
  delete from tradeshow.venues where id = p_source;
end $$;

create or replace function tradeshow.merge_shows(p_target uuid, p_source uuid)
returns void language plpgsql security definer set search_path = tradeshow as $$
begin
  if p_target = p_source or p_target is null or p_source is null then return; end if;
  update tradeshow.shipments     set show_id = p_target         where show_id = p_source;
  update tradeshow.contacts      set show_id = p_target         where show_id = p_source;
  update tradeshow.tasks         set related_show_id = p_target where related_show_id = p_source;
  update tradeshow.documents     set show_id = p_target         where show_id = p_source;
  update tradeshow.show_debriefs set show_id = p_target         where show_id = p_source;
  insert into tradeshow.show_exhibitors (show_id, exhibitor_id)
    select p_target, exhibitor_id from tradeshow.show_exhibitors where show_id = p_source
    on conflict (show_id, exhibitor_id) do nothing;
  delete from tradeshow.show_exhibitors where show_id = p_source;
  insert into tradeshow.carrier_shows (carrier_id, show_id)
    select carrier_id, p_target from tradeshow.carrier_shows where show_id = p_source
    on conflict (carrier_id, show_id) do nothing;
  delete from tradeshow.carrier_shows where show_id = p_source;
  update tradeshow.shows t set
    edition_year             = coalesce(t.edition_year, s.edition_year),
    industry_vertical        = coalesce(t.industry_vertical, s.industry_vertical),
    show_management_company   = coalesce(t.show_management_company, s.show_management_company),
    venue_id                 = coalesce(t.venue_id, s.venue_id),
    gsc_contact_id           = coalesce(t.gsc_contact_id, s.gsc_contact_id),
    website_url              = coalesce(t.website_url, s.website_url),
    exhibitor_manual_url     = coalesce(t.exhibitor_manual_url, s.exhibitor_manual_url),
    exhibitor_list_url       = coalesce(t.exhibitor_list_url, s.exhibitor_list_url),
    show_start_date          = coalesce(t.show_start_date, s.show_start_date),
    show_end_date            = coalesce(t.show_end_date, s.show_end_date),
    move_in_start            = coalesce(t.move_in_start, s.move_in_start),
    move_in_end              = coalesce(t.move_in_end, s.move_in_end),
    move_out_start           = coalesce(t.move_out_start, s.move_out_start),
    move_out_end             = coalesce(t.move_out_end, s.move_out_end),
    advance_warehouse_open   = coalesce(t.advance_warehouse_open, s.advance_warehouse_open),
    advance_warehouse_cutoff = coalesce(t.advance_warehouse_cutoff, s.advance_warehouse_cutoff),
    competitor_notes         = coalesce(t.competitor_notes, s.competitor_notes),
    general_notes            = coalesce(t.general_notes, s.general_notes)
  from tradeshow.shows s where t.id = p_target and s.id = p_source;
  delete from tradeshow.shows where id = p_source;
end $$;

-- ===== from 0024_shipment_tms_created_at.sql =====
-- The TMS load's own creation date (Hyperion `createdate`) — i.e. when the
-- quote/load was created in the TMS, distinct from created_at (our ingest time).
-- The Quotes view shows this as the "Quoted" date; left null when not provided.
alter table tradeshow.shipments
  add column if not exists tms_created_at timestamptz;

-- ===== from 0025_carrier_bill_to.sql =====
-- Per-carrier "Bill To" used on the move-out / outbound shipping form. When set,
-- the move-out form prints this instead of the default DTS bill-to.
alter table tradeshow.carriers
  add column if not exists bill_to_company  text,
  add column if not exists bill_to_address1 text,
  add column if not exists bill_to_address2 text,
  add column if not exists bill_to_city     text,
  add column if not exists bill_to_state    text,
  add column if not exists bill_to_zip      text,
  add column if not exists bill_to_phone    text;

-- ===== from 0026_show_sales_pipeline.sql =====
-- Sales / lead-gen pipeline fields on shows. The start-call (−60d), email-team
-- (−14d) and week-before (−7d) dates are derived from show_start_date in app
-- code, not stored.
alter table tradeshow.shows
  add column if not exists exhibitor_count           integer,
  add column if not exists decorator                 text,
  add column if not exists advance_warehouse_window  text,
  add column if not exists direct_to_show_window     text,
  add column if not exists sales_people              text,
  add column if not exists lead_gen_owner            text,
  add column if not exists lead_gen_start_date       date,
  add column if not exists lead_gen_completion_date  date,
  add column if not exists emailed_two_weeks         boolean not null default false,
  add column if not exists instantly_created         boolean not null default false,
  add column if not exists move_in_schedule_url      text;

-- ===== from 0027_marshalling_yard_and_preferred_carrier.sql =====
-- 1) Marshalling yard freight address + date window on shows (mirrors the
--    advance-warehouse / direct-to-show blocks).
alter table tradeshow.shows
  add column if not exists marshalling_yard_name     text,
  add column if not exists marshalling_yard_care_of  text,
  add column if not exists marshalling_yard_street1  text,
  add column if not exists marshalling_yard_street2  text,
  add column if not exists marshalling_yard_city     text,
  add column if not exists marshalling_yard_state    text,
  add column if not exists marshalling_yard_zip      text,
  add column if not exists marshalling_yard_country  text,
  add column if not exists marshalling_yard_address  text,
  add column if not exists marshalling_yard_open     date,
  add column if not exists marshalling_yard_cutoff   date;

-- 2) Preferred-carrier flag on the show <-> carrier link.
alter table tradeshow.carrier_shows
  add column if not exists preferred boolean not null default false;

-- ===== from 0028_load_candidate_customer_id.sql =====
-- Store the Hyperion customer number on scanned load candidates so the Load
-- Finder can deep-link each load to its shipment profile in Hyperion TMS
-- (same link the Suggestions page builds from shipments.tms_customer_id).
alter table tradeshow.tms_load_candidates
  add column if not exists tms_customer_id text;

comment on column tradeshow.tms_load_candidates.tms_customer_id is
  'Hyperion customer number, used to build the shipment-profile deep link.';

-- ===== from 0029_mha_check.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0029 MHA Check
-- Backs the Material Handling Agreement (MHA) verification tool.
--   * mha_submissions      — one row per uploaded MHA (photo/scan/PDF)
--   * mha_review_results   — the deterministic rule-engine output for a submission
--   * document_type 'MHA'  — lets a verified MHA attach to the load profile
--   * mha-uploads bucket    — private storage for the uploaded files
-- Follows the project convention: full access for any authenticated user,
-- anon gets nothing. Run AFTER 0028_load_candidate_customer_id.sql.
-- =============================================================================

-- Attaching a verified MHA to its load reuses the existing documents table, so
-- the enum needs an MHA value. Safe to add here: no statement in this migration
-- uses the new value (the app inserts MHA documents at runtime).
alter type tradeshow.document_type add value if not exists 'MHA';

-- ---------------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------------
create table tradeshow.mha_submissions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  submitter_name    text not null,
  submitter_phone   text not null,
  submitter_email   text not null,
  company_name      text not null,
  load_number_input text,                                       -- exactly what the user typed
  load_id           uuid references tradeshow.shipments(id),       -- null when no match
  match_method      text check (match_method in ('exact', 'fuzzy', 'none')),
  storage_path      text not null,
  file_mime         text not null,
  file_bytes        integer not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'passed', 'warning', 'failed', 'error'))
);

-- ---------------------------------------------------------------------------
-- Review results (deterministic rule-engine output)
-- ---------------------------------------------------------------------------
create table tradeshow.mha_review_results (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references tradeshow.mha_submissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  gc_detected   text,                     -- 'freeman' | 'ges' | 'shepard' | 'unknown'
  model         text not null,
  extracted     jsonb not null,           -- raw model output
  checks        jsonb not null,           -- array of CheckResult
  overall       text not null check (overall in ('passed', 'warning', 'failed'))
);

create index mha_submissions_load_id_idx on tradeshow.mha_submissions (load_id);
create index mha_review_results_submission_id_idx on tradeshow.mha_review_results (submission_id);

-- ---------------------------------------------------------------------------
-- RLS — full access for any authenticated user (project convention).
-- ---------------------------------------------------------------------------
alter table tradeshow.mha_submissions    enable row level security;
alter table tradeshow.mha_review_results enable row level security;

create policy "mha_submissions: all (authenticated)"
  on tradeshow.mha_submissions for all to authenticated using (true) with check (true);

create policy "mha_review_results: all (authenticated)"
  on tradeshow.mha_review_results for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Private storage bucket for uploaded MHAs. Access via signed URLs only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('mha-uploads', 'mha-uploads', false)
on conflict (id) do nothing;

create policy "tradeshow: mha-uploads bucket: read (authenticated)"
  on storage.objects for select to authenticated
  using (bucket_id = 'mha-uploads');

create policy "tradeshow: mha-uploads bucket: insert (authenticated)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mha-uploads');

create policy "tradeshow: mha-uploads bucket: update (authenticated)"
  on storage.objects for update to authenticated
  using (bucket_id = 'mha-uploads') with check (bucket_id = 'mha-uploads');

create policy "tradeshow: mha-uploads bucket: delete (authenticated)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mha-uploads');

-- ===== from 0030_shipment_forced.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0030 Forced freight (move-outs)
-- A move-out is "forced" when our carrier didn't show or there was a paperwork
-- error, so the general contractor force-shipped the freight onto their own
-- carrier. Operators flag it (with a reason) and can clear it. The dashboard
-- counts successful (non-forced) move-outs and restarts that count whenever a
-- load is forced. Run AFTER 0029_mha_check.sql.
-- =============================================================================

create type tradeshow.forced_reason as enum (
  'carrier_no_show',
  'paperwork_error',
  'missed_check_in',
  'other'
);

alter table tradeshow.shipments
  add column forced             boolean not null default false,
  add column forced_reason      tradeshow.forced_reason,
  add column forced_reason_other text,
  add column forced_at          timestamptz,
  add column forced_by          uuid references tradeshow.profiles(id);

comment on column tradeshow.shipments.forced is
  'True when this move-out was force-shipped by the general contractor (carrier no-show / paperwork error).';

-- Speeds up the dashboard "successful move-outs" streak query.
create index shipments_forced_idx on tradeshow.shipments (forced) where forced;
create index shipments_move_out_delivered_idx
  on tradeshow.shipments (direction, status)
  where direction = 'move_out';

-- ===== from 0031_user_contacts_and_show_assignees.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0031 User contacts + show assignees
-- Gives internal users reachable contact info, lets a show be staffed with
-- assigned users, and lets an MHA submission remember which show it resolved to
-- so the uploader can be shown who to call. Run AFTER 0030_shipment_forced.sql.
-- =============================================================================

-- Contact details on the internal user profile. is_mha_default_contact marks
-- the fallback contact shown when a show has no assigned team.
alter table tradeshow.profiles
  add column phone                  text,
  add column title                  text,
  add column is_mha_default_contact boolean not null default false;

-- Users staffed on a show. Full access for any authenticated user (project
-- convention); the page that manages it is admin-gated in the app.
create table tradeshow.show_assignees (
  id         uuid primary key default gen_random_uuid(),
  show_id    uuid not null references tradeshow.shows(id) on delete cascade,
  user_id    uuid not null references tradeshow.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (show_id, user_id)
);

alter table tradeshow.show_assignees enable row level security;
create policy "show_assignees: all (authenticated)"
  on tradeshow.show_assignees for all to authenticated using (true) with check (true);

create index show_assignees_show_id_idx on tradeshow.show_assignees (show_id);
create index show_assignees_user_id_idx on tradeshow.show_assignees (user_id);

-- Remember the show an MHA resolved to (via matched load or show-name), so the
-- result screen can surface the assigned contact on re-fetch too.
alter table tradeshow.mha_submissions
  add column show_id uuid references tradeshow.shows(id);

-- ===== from 0032_auto_link_default.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0032 Auto-link defaults
-- New TMS shipments are sync-managed until an operator touches them: default the
-- venue/show auto-link flags to true. The sync then auto-links only while the
-- flag is true, and an operator save (which sets the flag false) is respected —
-- so clearing a show no longer gets re-linked on the next sync.
-- Manually-created shipments set both flags false explicitly, so they're
-- unaffected. Run AFTER 0031_user_contacts_and_show_assignees.sql.
-- =============================================================================

alter table tradeshow.shipments alter column venue_auto_linked set default true;
alter table tradeshow.shipments alter column show_auto_linked  set default true;

-- ===== from 0033_activity_log.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0033 Activity log
-- Append-only audit trail of who did what: shipment edits, forced flags, status
-- changes, deletes, etc. Readable by any authenticated user; insert-only (no
-- update/delete) so the history can't be rewritten. Run AFTER 0032.
-- =============================================================================

create table tradeshow.activity_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid references tradeshow.profiles(id),
  action       text not null,   -- created | updated | deleted | forced | unforced | status_changed
  entity_type  text not null,   -- shipment | show | ...
  entity_id    uuid,
  entity_label text,            -- human-readable name at the time of the action
  summary      text,            -- what changed, in plain language
  details      jsonb            -- optional structured payload (field diffs, etc.)
);

create index activity_log_created_idx on tradeshow.activity_log (created_at desc);
create index activity_log_entity_idx on tradeshow.activity_log (entity_type, entity_id);
create index activity_log_user_idx on tradeshow.activity_log (user_id);

alter table tradeshow.activity_log enable row level security;

-- Read for everyone signed in; insert for everyone signed in (writes happen in
-- server actions under the acting user's session). No update/delete policy →
-- the log is append-only.
create policy "activity_log: read (authenticated)"
  on tradeshow.activity_log for select to authenticated using (true);

create policy "activity_log: insert (authenticated)"
  on tradeshow.activity_log for insert to authenticated with check (true);

-- ===== from 0034_directory_stats.sql =====
-- Aggregate shipment counts per directory entity, computed in the database so
-- the Exhibitors / Carriers / Venues list pages don't pull the whole shipments
-- table into the app just to count loads per row.

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

-- ===== from 0035_exhibitor_sales_book.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0035 Exhibitor sales book
-- Turns the exhibitor directory into a manageable book of business. Adds the
-- sales-ownership + prioritization fields and the historical roll-ups that the
-- legacy customer master carried (rep, status, tier, TTM/legacy loads & margin,
-- websites, shows shipped), plus a per-exhibitor per-show shipping history so a
-- dormant/legacy customer isn't blank in the directory. Run AFTER 0034.
--
-- These columns are additive and nullable — existing TMS-created exhibitors are
-- unaffected until enriched. The one-time legacy import populates them via
-- scripts/import-legacy-customers.mjs.
-- =============================================================================

alter table tradeshow.exhibitors
  -- Sales ownership / prioritization (managed in the app).
  add column if not exists owner_rep             text,
  add column if not exists sales_status          text,   -- active | dormant | not_in_tms | null
  add column if not exists priority_tier         text,   -- A | B | C | D | Internal
  add column if not exists priority_tier_label   text,   -- full original label, e.g. "A - Warm, high value"
  add column if not exists website               text,
  add column if not exists source                text not null default 'manual',  -- manual | tms | legacy_import
  -- Trailing-twelve-month activity (from the legacy report snapshot).
  add column if not exists ttm_loads             integer,
  add column if not exists ttm_margin            numeric,
  add column if not exists last_pickup           date,
  -- Lifetime / legacy roll-ups.
  add column if not exists legacy_loads          integer,
  add column if not exists legacy_first_year     integer,
  add column if not exists legacy_last_year      integer,
  add column if not exists legacy_billed         numeric,
  add column if not exists legacy_margin         numeric,
  add column if not exists legacy_margin_per_load numeric,
  -- Reference text carried over verbatim for context.
  add column if not exists shows_shipped         text,
  add column if not exists shows_confirmed_2026  text,
  add column if not exists top_show_cities       text,
  add column if not exists imported_at           timestamptz;

-- Filter/sort helpers for the directory.
create index if not exists exhibitors_sales_status_idx  on tradeshow.exhibitors (sales_status);
create index if not exists exhibitors_priority_tier_idx on tradeshow.exhibitors (priority_tier);
create index if not exists exhibitors_owner_rep_idx     on tradeshow.exhibitors (owner_rep);
-- Case-insensitive name lookups for the importer's dedupe-by-name.
create index if not exists exhibitors_company_name_lower_idx
  on tradeshow.exhibitors (lower(company_name));

-- Per-exhibitor, per-show shipping history from the legacy "Customers by Show"
-- sheet. show_name is free text (legacy show labels don't map 1:1 to the shows
-- table); kept as reference on the exhibitor detail page.
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

-- Full access for any authenticated user (project convention; management UI is
-- app-gated).
create policy "exhibitor_show_history: all (authenticated)"
  on tradeshow.exhibitor_show_history for all to authenticated using (true) with check (true);

-- ===== from 0036_show_history_summary.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0036 Show history summary view
-- Reverse index over the legacy per-exhibitor show history: aggregates
-- exhibitor_show_history by (free-text) show_name so the app can answer "who
-- ships at this show historically?" — the legacy show names don't map 1:1 to
-- the edition-specific `shows` records, so this stays name-keyed. Run AFTER 0035.
--
-- security_invoker so the caller's RLS on exhibitor_show_history applies.
-- =============================================================================

create or replace view tradeshow.show_history_summary
with (security_invoker = on) as
select
  show_name,
  count(*)::int                                        as exhibitor_count,
  coalesce(sum(show_loads), 0)::int                    as total_loads,
  coalesce(sum(margin), 0)                             as total_margin,
  count(*) filter (where confirmed_2026 is not null)::int as confirmed_2026_count,
  min(first_year)                                      as first_year,
  max(last_year)                                       as last_year
from tradeshow.exhibitor_show_history
group by show_name;

-- ===== from 0037_show_history_confirmed_fix.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0037 Fix show_history_summary 2026 count
-- confirmed_2026 on each history row is the customer's WHOLE list of 2026-
-- confirmed shows (duplicated across their rows), not a per-show flag. The
-- original view counted any non-null value, which over-counted "returning in
-- 2026". Recompute it as: this show appears in the customer's 2026 list,
-- comparing on alphanumerics only (names differ between the legacy history and
-- the 2026 list). Run AFTER 0036.
-- =============================================================================

create or replace view tradeshow.show_history_summary
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
from tradeshow.exhibitor_show_history
group by show_name;

-- ===== from 0038_show_history_canonical.sql =====
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

-- Re-key the summary on the canonical name, counting DISTINCT exhibitors (a
-- customer may have several variant rows that now collapse into one show).
create or replace view tradeshow.show_history_summary
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
from tradeshow.exhibitor_show_history
group by canonical_show_name;

-- ===== from 0039_show_roster.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0039 Show roster (authoritative 2026 attendance)
-- Roster Match can save a show's uploaded exhibitor list as the real record of
-- who's exhibiting that show in a given year (default 2026), replacing the
-- fuzzy scraped `confirmed_2026` guess. Keyed on the canonical show name so it
-- lines up with show_history_summary. Run AFTER 0038.
-- =============================================================================

create table if not exists tradeshow.exhibitor_show_roster (
  id           uuid primary key default gen_random_uuid(),
  show_name    text not null,                 -- canonical show name
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

-- Prefer a saved 2026 roster for "Returning 2026"; fall back to the fuzzy scrape
-- when no roster has been uploaded for a show. has_roster_2026 tells the UI which.
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

-- ===== from 0040_customers.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0040 Customer master
-- Your full customer list (including freight customers who don't do trade
-- shows). Kept separate from the trade-show exhibitor directory; Roster Match
-- checks both so a roster company can surface as an existing customer even with
-- no show history. Populated from a customer export. Run AFTER 0039.
-- =============================================================================

create table if not exists tradeshow.customers (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null,
  external_id  text,          -- TMS / accounting customer id, if any
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

-- ===== from 0041_customers_address.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0041 Customer contact/address fields
-- The customer master export carries phone/fax and a full mailing address; keep
-- them so the customer list is useful for outreach, not just name matching.
-- Run AFTER 0040.
-- =============================================================================

alter table tradeshow.customers
  add column if not exists phone    text,
  add column if not exists fax      text,
  add column if not exists address  text,
  add column if not exists address2 text,
  add column if not exists zip      text;

-- ===== from 0042_exhibitor_status_reason.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0042 Exhibitor status reason
-- A structured reason for the relationship state (esp. why we're not working
-- with them) so the directory can be filtered by it — complements the free-text
-- notes. Run AFTER 0041.
-- =============================================================================

alter table tradeshow.exhibitors
  add column if not exists status_reason text;

create index if not exists exhibitors_status_reason_idx on tradeshow.exhibitors (status_reason);

-- ===== from 0043_shipment_move_out_manual.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0043 Manual move-out details lock
-- The move-out PDF is built from booth number, the ship-to / consignee block,
-- and piece count — all normally populated by the TMS (Hyperion) sync, which
-- overwrites them on every run. This flag marks those fields as operator-owned
-- so a hand correction survives future syncs (mirrors venue_auto_linked /
-- show_auto_linked). Run AFTER 0042.
-- =============================================================================

alter table tradeshow.shipments
  add column if not exists move_out_manual boolean not null default false;

-- ===== from 0044_shipment_cancelled_at.sql =====
-- =============================================================================
-- DTS Trade Show CRM — 0044 Cancelled shipments
-- The shipment_status enum has no "cancelled" state, and a load cancelled in
-- the TMS after it was booked otherwise stays frozen as booked (still on the
-- calendar). This marks cancellation without an enum change: cancelled_at is
-- set by the sync when the TMS reports the load Cancelled, and cleared if it
-- reactivates. Active views (calendar) hide rows where cancelled_at is set;
-- the shipment record is kept with a "Cancelled" badge. Run AFTER 0043.
-- =============================================================================

alter table tradeshow.shipments
  add column if not exists cancelled_at timestamptz;

create index if not exists shipments_cancelled_at_idx on tradeshow.shipments (cancelled_at);
