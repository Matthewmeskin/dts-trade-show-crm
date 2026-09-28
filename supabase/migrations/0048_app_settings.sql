-- =============================================================================
-- DTS Trade Show CRM - 0048 app settings: switches an admin flips in the CRM.
--
-- The first one is 'partner_tools': the partner growth tooling that the GSC
-- Shipping Center replaced (the worklist, booked calls, the weekly client
-- report, rebate statements, cobranded show page controls). Off by default:
-- hidden, not removed. No table, data or migration is dropped; turning it on
-- brings every screen back as it was.
--
-- Applied to DTS Database as the tradeshow variant in ./tradeshow/, only after
-- Matthew has seen the SQL and point in time recovery is confirmed.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

create table public.app_settings (
  key         text primary key check (key in ('partner_tools')),
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null default auth.uid()
);
insert into public.app_settings (key, enabled) values ('partner_tools', false);

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Everyone on the team reads (the screens need to know); only admins flip.
alter table public.app_settings enable row level security;
create policy members_read on public.app_settings
  for select to authenticated using (public.is_member());
create policy admins_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.app_settings from public, anon, authenticated, service_role;
grant select, update on public.app_settings to authenticated;
grant select, update on public.app_settings to service_role;
