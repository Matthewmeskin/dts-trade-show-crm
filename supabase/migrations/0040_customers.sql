-- =============================================================================
-- DTS Trade Show CRM — 0040 Customer master
-- Your full customer list (including freight customers who don't do trade
-- shows). Kept separate from the trade-show exhibitor directory; Roster Match
-- checks both so a roster company can surface as an existing customer even with
-- no show history. Populated from a customer export. Run AFTER 0039.
-- =============================================================================

create table if not exists public.customers (
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

create index if not exists customers_company_name_lower_idx on public.customers (lower(company_name));
create index if not exists customers_external_id_idx on public.customers (external_id);

alter table public.customers enable row level security;
create policy "customers: all (authenticated)"
  on public.customers for all to authenticated using (true) with check (true);
