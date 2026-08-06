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

alter table public.exhibitors
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
create index if not exists exhibitors_sales_status_idx  on public.exhibitors (sales_status);
create index if not exists exhibitors_priority_tier_idx on public.exhibitors (priority_tier);
create index if not exists exhibitors_owner_rep_idx     on public.exhibitors (owner_rep);
-- Case-insensitive name lookups for the importer's dedupe-by-name.
create index if not exists exhibitors_company_name_lower_idx
  on public.exhibitors (lower(company_name));

-- Per-exhibitor, per-show shipping history from the legacy "Customers by Show"
-- sheet. show_name is free text (legacy show labels don't map 1:1 to the shows
-- table); kept as reference on the exhibitor detail page.
create table if not exists public.exhibitor_show_history (
  id             uuid primary key default gen_random_uuid(),
  exhibitor_id   uuid not null references public.exhibitors(id) on delete cascade,
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
  on public.exhibitor_show_history (exhibitor_id);

alter table public.exhibitor_show_history enable row level security;

-- Full access for any authenticated user (project convention; management UI is
-- app-gated).
create policy "exhibitor_show_history: all (authenticated)"
  on public.exhibitor_show_history for all to authenticated using (true) with check (true);
