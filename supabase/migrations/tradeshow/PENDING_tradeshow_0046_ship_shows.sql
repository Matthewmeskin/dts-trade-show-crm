-- DTS Trade Show CRM - 0046 Shipping Center shows, permanent partner codes, shipment source.
-- tradeshow variant of ../0046_ship_shows.sql, for DTS Database (qshciqxpkirlkmrwucnk).
-- NOT YET APPLIED: renamed to <applied version>_tradeshow_0046_ship_shows.sql once it runs.
-- Touches only the tradeshow schema.

-- ---------------------------------------------------------------------------
-- Which edition each GSC runs through its Shipping Center
-- ---------------------------------------------------------------------------
create table tradeshow.ship_shows (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references tradeshow.partners(id) on delete restrict,
  -- The edition (one year). Restrict, not cascade: requests will hang off this
  -- row, so merging or deleting a show that a GSC runs has to be a decision.
  show_id            uuid not null references tradeshow.shows(id) on delete restrict,
  enabled            boolean not null default true,
  -- Business days the request form allows for transit when it suggests dates.
  transit_days       smallint not null default 5 check (transit_days between 1 and 30),
  request_cap        integer check (request_cap is null or request_cap > 0),
  manifest_email     text not null default 'off' check (manifest_email in ('off', 'weekly_then_daily')),
  outbound_email     boolean not null default false,
  coordinator_name   text,
  coordinator_mobile text,
  created_by         uuid references tradeshow.profiles(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (partner_id, show_id)
);
create index ship_shows_show_idx on tradeshow.ship_shows (show_id);

create trigger trg_ship_shows_updated_at
  before update on tradeshow.ship_shows
  for each row execute function tradeshow.set_updated_at();

-- ---------------------------------------------------------------------------
-- The GSC's Shipping Center details, on the partner
-- ---------------------------------------------------------------------------
alter table tradeshow.partners
  add column if not exists ship_phone     text,
  add column if not exists ship_email     text,
  add column if not exists label_settings jsonb not null default '{}'::jsonb;

alter table tradeshow.partners
  add constraint partners_ship_email_shape check (ship_email is null or ship_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add constraint partners_label_settings_object check (jsonb_typeof(label_settings) = 'object');

-- ---------------------------------------------------------------------------
-- Codes printed in kits are permanent
--
-- Once a partner's code has been in a kit link (it has a Shipping Center show,
-- or cobranding is on or has a cobranded show), changing it keeps the old code
-- here, and the public project redirects the old links. A retired code can
-- never go to another partner, and a code in kit links can't be cleared.
-- ---------------------------------------------------------------------------
create table tradeshow.partner_code_history (
  old_code   text primary key,
  partner_id uuid not null references tradeshow.partners(id) on delete restrict,
  retired_at timestamptz not null default now(),
  retired_by uuid references tradeshow.profiles(id) on delete set null
);
create index partner_code_history_partner_idx on tradeshow.partner_code_history (partner_id);

create or replace function tradeshow.guard_partner_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_kits boolean;
begin
  if tg_op = 'UPDATE' and new.code is not distinct from old.code then
    return new;
  end if;

  if new.code is not null and exists (
    select 1 from tradeshow.partner_code_history h
    where h.old_code = new.code and h.partner_id <> new.id
  ) then
    raise exception 'The code "%" belonged to another partner and stays retired so their kit links keep working. Pick another code.', new.code
      using errcode = '23505';
  end if;

  if tg_op = 'UPDATE' and old.code is not null then
    v_in_kits := old.cobrand_active
      or exists (select 1 from tradeshow.ship_shows s where s.partner_id = old.id)
      or exists (select 1 from tradeshow.partner_shows ps where ps.partner_id = old.id and ps.cobranded);
    if v_in_kits then
      if new.code is null then
        raise exception 'This partner''s code is in kit links, so it can''t be removed. Change it instead; the old links will redirect.'
          using errcode = '23514';
      end if;
      insert into tradeshow.partner_code_history (old_code, partner_id, retired_by)
      values (old.code, old.id, auth.uid())
      on conflict (old_code) do nothing;
    end if;
  end if;

  -- Taking back one of its own retired codes: it is live again, not a redirect.
  if new.code is not null then
    delete from tradeshow.partner_code_history h where h.old_code = new.code and h.partner_id = new.id;
  end if;

  return new;
end $$;
revoke all on function tradeshow.guard_partner_code() from public, anon, authenticated;

create trigger trg_partners_guard_code
  before insert or update of code on tradeshow.partners
  for each row execute function tradeshow.guard_partner_code();

-- ---------------------------------------------------------------------------
-- Where a shipment came from. Shipping Center freight earns no partner credit
-- (the GSC pays nothing and earns nothing: spec section 9), so a Shipping
-- Center load can never carry a partner, and so never reaches a rebate.
-- ---------------------------------------------------------------------------
alter table tradeshow.shipments
  add column if not exists source text not null default 'tms';
alter table tradeshow.shipments
  add constraint shipments_source check (source in ('tms', 'ship_center')),
  add constraint shipments_ship_center_no_partner_credit check (source <> 'ship_center' or partner_id is null);

-- ---------------------------------------------------------------------------
-- RLS. Everyone on the team reads; switching a Shipping Center on or off is
-- admin only during the pilot (it puts a GSC's kit links live). No deletes:
-- switching off is enabled = false. The code history is written only by the
-- trigger.
-- ---------------------------------------------------------------------------
alter table tradeshow.ship_shows           enable row level security;
alter table tradeshow.partner_code_history enable row level security;

create policy members_read on tradeshow.ship_shows
  for select to authenticated using (tradeshow.is_member());
create policy admins_insert on tradeshow.ship_shows
  for insert to authenticated with check (tradeshow.is_admin());
create policy admins_update on tradeshow.ship_shows
  for update to authenticated using (tradeshow.is_admin()) with check (tradeshow.is_admin());

create policy members_read on tradeshow.partner_code_history
  for select to authenticated using (tradeshow.is_member());

-- The schema's default privileges would also grant DELETE to authenticated
-- and service_role; nobody deletes these rows.
revoke all on tradeshow.ship_shows, tradeshow.partner_code_history from public, anon, authenticated, service_role;
grant select, insert, update on tradeshow.ship_shows to authenticated;
grant select on tradeshow.partner_code_history to authenticated;
grant select, insert, update on tradeshow.ship_shows, tradeshow.partner_code_history to service_role;
