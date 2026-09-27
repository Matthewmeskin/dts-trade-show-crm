-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260927040305 "tradeshow_0044_partner_credit_and_rebates".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

alter table tradeshow.shipments
  add column if not exists partner_id uuid references tradeshow.partners(id) on delete set null,
  add column if not exists partner_credit_source text,
  add column if not exists partner_credited_at timestamptz,
  add column if not exists partner_credited_by uuid references tradeshow.profiles(id) on delete set null;

alter table tradeshow.shipments
  add constraint shipments_partner_credit_source check (
    partner_credit_source is null or partner_credit_source in ('referral_code', 'client', 'manual')
  );

create index if not exists shipments_partner_idx on tradeshow.shipments (partner_id) where partner_id is not null;

create table tradeshow.partner_rebate_statements (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references tradeshow.partners(id) on delete restrict,
  quarter          text not null check (quarter ~ '^[0-9]{4}-Q[1-4]$'),
  period_start     date not null,
  period_end       date not null check (period_end >= period_start),
  rebate_pct       numeric(5,2) not null check (rebate_pct > 0 and rebate_pct <= 100),
  commission_basis text check (commission_basis is null or commission_basis in ('before_rebate', 'after_rebate')),
  line_count       integer not null check (line_count > 0),
  billed_total     numeric(12,2) not null,
  margin_total     numeric(12,2) not null,
  rebate_total     numeric(12,2) not null check (rebate_total >= 0),
  status           text not null default 'issued' check (status in ('issued', 'paid')),
  issued_at        timestamptz not null default now(),
  issued_by        uuid references tradeshow.profiles(id) on delete set null default auth.uid(),
  sent_at          timestamptz,
  paid_on          date,
  paid_ref         text,
  paid_by          uuid references tradeshow.profiles(id) on delete set null,
  notes            text,
  unique (partner_id, quarter),
  constraint partner_rebate_paid_complete check ((status = 'paid') = (paid_on is not null))
);
create index partner_rebate_statements_partner_idx on tradeshow.partner_rebate_statements (partner_id, period_end desc);

create table tradeshow.partner_rebate_lines (
  id                uuid primary key default gen_random_uuid(),
  statement_id      uuid not null references tradeshow.partner_rebate_statements(id) on delete cascade,
  shipment_id       uuid references tradeshow.shipments(id) on delete set null,
  tms_reference_id  text,
  exhibitor_name    text,
  show_name         text,
  invoice_nos       text,
  paid_on           date not null,
  billed            numeric(12,2) not null,
  cost              numeric(12,2) not null,
  margin            numeric(12,2) not null,
  rebate            numeric(12,2) not null check (rebate >= 0)
);
create unique index partner_rebate_lines_shipment_once on tradeshow.partner_rebate_lines (shipment_id) where shipment_id is not null;
create index partner_rebate_lines_statement_idx on tradeshow.partner_rebate_lines (statement_id);

create or replace function tradeshow.guard_partner_credit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.partner_id is distinct from old.partner_id
     and exists (select 1 from tradeshow.partner_rebate_lines l where l.shipment_id = old.id) then
    raise exception 'This load is on a rebate statement already, so its partner credit can''t change.'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_shipments_guard_partner_credit
  before update of partner_id on tradeshow.shipments
  for each row execute function tradeshow.guard_partner_credit();

create or replace function tradeshow.issue_rebate_statement(
  p_partner_id       uuid,
  p_quarter          text,
  p_period_start     date,
  p_period_end       date,
  p_rebate_pct       numeric,
  p_commission_basis text,
  p_lines            jsonb
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A statement needs at least one paid load.' using errcode = '22023';
  end if;

  insert into tradeshow.partner_rebate_statements (
    partner_id, quarter, period_start, period_end, rebate_pct, commission_basis,
    line_count, billed_total, margin_total, rebate_total
  )
  select p_partner_id, p_quarter, p_period_start, p_period_end, p_rebate_pct, p_commission_basis,
         count(*), sum((l->>'billed')::numeric), sum((l->>'margin')::numeric), sum((l->>'rebate')::numeric)
  from jsonb_array_elements(p_lines) l
  returning id into v_id;

  insert into tradeshow.partner_rebate_lines (
    statement_id, shipment_id, tms_reference_id, exhibitor_name, show_name, invoice_nos,
    paid_on, billed, cost, margin, rebate
  )
  select v_id, (l->>'shipment_id')::uuid, l->>'tms_reference_id', l->>'exhibitor_name', l->>'show_name',
         l->>'invoice_nos', (l->>'paid_on')::date, (l->>'billed')::numeric, (l->>'cost')::numeric,
         (l->>'margin')::numeric, (l->>'rebate')::numeric
  from jsonb_array_elements(p_lines) l;

  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    join tradeshow.shipments s on s.id = (l->>'shipment_id')::uuid
    where s.partner_id is distinct from p_partner_id
  ) then
    raise exception 'A load on this statement is no longer credited to this partner. Reload and try again.'
      using errcode = '23514';
  end if;

  return v_id;
end $$;

revoke all on function tradeshow.issue_rebate_statement(uuid, text, date, date, numeric, text, jsonb) from public, anon;
grant execute on function tradeshow.issue_rebate_statement(uuid, text, date, date, numeric, text, jsonb) to authenticated;

create or replace function tradeshow.shipment_ar_status(p_shipment_ids uuid[])
returns table (
  shipment_id  uuid,
  ar_status    text,
  invoice_nos  text[],
  invoiced     numeric,
  open_balance numeric,
  paid_on      date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not tradeshow.is_member() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if to_regclass('public.ap_ledger_invoices') is null then
    return query
      select s.id, 'no_ledger'::text, array[]::text[], null::numeric, null::numeric, null::date
      from tradeshow.shipments s where s.id = any (p_shipment_ids);
    return;
  end if;

  return query
    select
      s.id,
      case
        when nullif(btrim(s.tms_reference_id), '') is null then 'no_reference'
        when count(g.id) = 0 then 'not_in_ledger'
        when bool_and(g.balance = 0 and g.closed_at is not null) then 'paid'
        else 'open'
      end,
      coalesce(array_agg(distinct g.invoice_no) filter (where g.id is not null), array[]::text[]),
      sum(g.invoice_amt),
      sum(g.balance),
      case
        when count(g.id) > 0 and bool_and(g.balance = 0 and g.closed_at is not null)
          then max((g.closed_at at time zone 'America/Los_Angeles')::date)
      end
    from tradeshow.shipments s
    left join public.ap_ledger_invoices g
      on g.side = 'AR'
     and g.invoice_type = 'IN'
     and g.invoice_no in ('N' || btrim(s.tms_reference_id), 'AN' || btrim(s.tms_reference_id))
    where s.id = any (p_shipment_ids)
    group by s.id, s.tms_reference_id;
end $$;

revoke all on function tradeshow.shipment_ar_status(uuid[]) from public, anon;
grant execute on function tradeshow.shipment_ar_status(uuid[]) to authenticated;

alter table tradeshow.partner_rebate_statements enable row level security;
alter table tradeshow.partner_rebate_lines enable row level security;

create policy members_read on tradeshow.partner_rebate_statements
  for select to authenticated using (tradeshow.is_member());
create policy admins_insert on tradeshow.partner_rebate_statements
  for insert to authenticated with check (tradeshow.is_admin());
create policy admins_update on tradeshow.partner_rebate_statements
  for update to authenticated using (tradeshow.is_admin()) with check (tradeshow.is_admin());
create policy admins_delete_unpaid on tradeshow.partner_rebate_statements
  for delete to authenticated using (tradeshow.is_admin() and status <> 'paid');

create policy members_read on tradeshow.partner_rebate_lines
  for select to authenticated using (tradeshow.is_member());
create policy admins_insert on tradeshow.partner_rebate_lines
  for insert to authenticated with check (tradeshow.is_admin());

grant select, insert, update, delete on tradeshow.partner_rebate_statements to authenticated;
grant select, insert on tradeshow.partner_rebate_lines to authenticated;
grant all on tradeshow.partner_rebate_statements, tradeshow.partner_rebate_lines to service_role;
