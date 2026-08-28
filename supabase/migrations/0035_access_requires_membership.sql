-- Access to this CRM is membership in tradeshow.profiles, and nothing less.
--
-- The login is shared with the other DTS portals (payables, vetting,
-- Exemplis), so authenticating here proved only that someone holds a DTS
-- account. Three layers all failed open at once: the proxy checked
-- authentication only, the app layout read `profile?.role ?? "standard"` so a
-- missing row became a standard user, and all 20 data tables carried
-- `using (true)` for the authenticated role. Revoking CRM access removed the
-- profiles row, which greyed the card on the operations dashboard and changed
-- nothing else -- the account could still open the CRM by URL and read and
-- write everything.
--
-- The layout gate ships alongside this. This half is the one that holds even
-- if the app is bypassed entirely: without a profiles row, PostgREST returns
-- empty for every table here.
--
-- The TMS ingest routes (/api/tms/scan, /shipments, /load-numbers) all use the
-- service role and bypass RLS, so the n8n pipelines are unaffected.

-- SECURITY DEFINER so a policy on tradeshow.profiles can call this without
-- recursing into that table's own RLS.
create or replace function tradeshow.is_member()
returns boolean
language sql
stable
security definer
set search_path to 'tradeshow'
as $$
  select exists (select 1 from tradeshow.profiles where id = auth.uid());
$$;

revoke all on function tradeshow.is_member() from public;
grant execute on function tradeshow.is_member() to authenticated;

-- Every `true` policy in the schema becomes a membership test. A loop rather
-- than 20 hand-written ALTERs so none is missed.
do $$
declare r record;
begin
  for r in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'tradeshow'
      and tablename <> 'profiles'
      and (qual::text = 'true' or with_check::text = 'true')
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on tradeshow.%I with check (tradeshow.is_member())',
                     r.policyname, r.tablename);
    elsif r.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on tradeshow.%I using (tradeshow.is_member())',
                     r.policyname, r.tablename);
    else
      execute format('alter policy %I on tradeshow.%I using (tradeshow.is_member()) with check (tradeshow.is_member())',
                     r.policyname, r.tablename);
    end if;
  end loop;
end $$;

-- profiles is the exception. The operations dashboard's Users page reads this
-- whole roster (through the public.crm_users view) to render each account's
-- Trade Show column, as the signed-in payables admin. Gating it on membership
-- alone would show an admin who is not a CRM member an empty roster -- and
-- saving a row would then post crm=none and silently revoke everyone.
alter policy "profiles: read all (authenticated)" on tradeshow.profiles
  using (tradeshow.is_member() or public.is_ap_admin());
