-- Access to this CRM is membership in profiles, and nothing less.
--
-- The DTS login is shared across the payables, vetting and Exemplis portals as
-- well as this one, so authenticating proved only that someone holds a DTS
-- account. Three gates failed open together: the proxy checked authentication
-- only, the app layout read `profile?.role ?? "standard"` so a missing row
-- became a standard user, and every business table below carried
-- `using (true)` for the authenticated role (see 0002_rls.sql). Revoking a
-- user's access removed their profiles row, which changed nothing they could
-- actually reach.
--
-- The layout gate ships with this. This half is the one that holds even when
-- the app is bypassed: with no profiles row, PostgREST returns empty for every
-- table here.
--
-- The TMS ingest routes (/api/tms/scan, /shipments, /load-numbers) use the
-- service role and bypass RLS, so the n8n pipelines are unaffected.

-- Guard: this migration belongs to the CRM's own database. The DTS operations
-- project carries a COPY of these tables in a `tradeshow` schema, and its
-- public schema is the payables ledger -- running this there would rewrite
-- payables policies. Fail loudly rather than do that.
do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

-- SECURITY DEFINER so a policy on profiles can call it without recursing into
-- that table's own RLS.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- Every `true` policy on a CRM business table becomes a membership test.
-- Driven off an explicit table list rather than "every policy in public", so
-- the blast radius is exactly this application's own tables.
do $$
declare
  crm_tables text[] := array[
    'activity_log', 'carrier_shows', 'carrier_venues', 'carriers', 'contacts',
    'customers', 'documents', 'exhibitor_show_history', 'exhibitor_show_roster',
    'exhibitors', 'mha_review_results', 'mha_submissions', 'shipments',
    'show_assignees', 'show_debriefs', 'show_exhibitors', 'shows', 'tasks',
    'tms_load_candidates', 'venues'
  ];
  r record;
begin
  for r in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename = any (crm_tables)
      and (qual::text = 'true' or with_check::text = 'true')
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (public.is_member())',
                     r.policyname, r.tablename);
    elsif r.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on public.%I using (public.is_member())',
                     r.policyname, r.tablename);
    else
      execute format('alter policy %I on public.%I using (public.is_member()) with check (public.is_member())',
                     r.policyname, r.tablename);
    end if;
  end loop;
end $$;

-- The roster stays readable to members so the app can render assignee and
-- owner names; a non-member now reads nothing here either.
alter policy "profiles: read all (authenticated)" on public.profiles
  using (public.is_member());
