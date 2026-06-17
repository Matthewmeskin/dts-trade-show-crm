-- =============================================================================
-- DTS Trade Show CRM — 0002 Row Level Security
-- Internal multi-user model: every authenticated (logged-in) user has full
-- read/write access to the business tables. profiles are readable by all,
-- self-editable, and protected against role self-escalation. anon has no access.
-- Run AFTER 0001_schema.sql.
-- =============================================================================

-- Make the status view respect the querying user's RLS on `shows`
-- (Postgres 15+ / Supabase). Without this the view would run as its owner.
alter view public.shows_with_status set (security_invoker = true);

-- Helper: apply a full-access authenticated policy to a business table.
-- (Written out explicitly per-table below for clarity / auditability.)

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.venues          enable row level security;
alter table public.carriers        enable row level security;
alter table public.exhibitors      enable row level security;
alter table public.shows           enable row level security;
alter table public.contacts        enable row level security;
alter table public.show_exhibitors enable row level security;
alter table public.shipments       enable row level security;
alter table public.documents       enable row level security;
alter table public.show_debriefs   enable row level security;
alter table public.carrier_venues  enable row level security;
alter table public.tasks           enable row level security;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create policy "profiles: read all (authenticated)"
  on public.profiles for select to authenticated using (true);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: admin update any"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Prevent a non-admin from changing their own role (privilege escalation).
create or replace function public.enforce_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change a user role';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_enforce_role
  before update on public.profiles
  for each row execute function public.enforce_role_change();

-- ---------------------------------------------------------------------------
-- Business tables — full access for any authenticated user.
-- ---------------------------------------------------------------------------
create policy "venues: all (authenticated)"
  on public.venues for all to authenticated using (true) with check (true);

create policy "carriers: all (authenticated)"
  on public.carriers for all to authenticated using (true) with check (true);

create policy "exhibitors: all (authenticated)"
  on public.exhibitors for all to authenticated using (true) with check (true);

create policy "shows: all (authenticated)"
  on public.shows for all to authenticated using (true) with check (true);

create policy "contacts: all (authenticated)"
  on public.contacts for all to authenticated using (true) with check (true);

create policy "show_exhibitors: all (authenticated)"
  on public.show_exhibitors for all to authenticated using (true) with check (true);

create policy "shipments: all (authenticated)"
  on public.shipments for all to authenticated using (true) with check (true);

create policy "documents: all (authenticated)"
  on public.documents for all to authenticated using (true) with check (true);

create policy "show_debriefs: all (authenticated)"
  on public.show_debriefs for all to authenticated using (true) with check (true);

create policy "carrier_venues: all (authenticated)"
  on public.carrier_venues for all to authenticated using (true) with check (true);

create policy "tasks: all (authenticated)"
  on public.tasks for all to authenticated using (true) with check (true);
