-- =============================================================================
-- DTS Trade Show CRM — 0044 Partner credit on shipments, and rebate statements
--
-- The rebate model from the Partner Growth Plan: DTS bills the exhibitor, and
-- the partner who sent them earns a share of DTS gross margin, paid quarterly
-- on PAID invoices only.
--
--   shipments.partner_id       which partner gets credit for the load, and why
--                              (their referral code on the quote, one of their
--                              clients, or a rep's call). Set by a person; the
--                              CRM only suggests.
--   partner_rebate_statements  one per partner per quarter, frozen when issued:
--                              the rebate % and every line are copied in, so a
--                              later change to the terms or a load can't
--                              quietly change what was promised.
--   partner_rebate_lines       one row per shipment paid on a statement. A
--                              shipment can be on only one statement, ever -
--                              that unique index is what stops paying twice.
--   shipment_ar_status()       whether each load's customer invoice is paid,
--                              read from the Sage AR ledger that the payables
--                              portal keeps in the same database. Members can
--                              ask about shipments; nothing else in the ledger
--                              is exposed.
--
-- Issuing and marking a statement paid are admin-only: they commit DTS money.
--
-- Applied live to DTS Database (tradeshow schema variant) 2026-09-27. There the
-- ledger is public.ap_ledger_invoices; in a standalone CRM project it doesn't
-- exist and shipment_ar_status() answers 'no_ledger' for everything.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Credit on the shipment
-- ---------------------------------------------------------------------------
alter table public.shipments
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists partner_credit_source text,
  add column if not exists partner_credited_at timestamptz,
  add column if not exists partner_credited_by uuid references public.profiles(id) on delete set null;

alter table public.shipments
  add constraint shipments_partner_credit_source check (
    partner_credit_source is null or partner_credit_source in ('referral_code', 'client', 'manual')
  );

create index if not exists shipments_partner_idx on public.shipments (partner_id) where partner_id is not null;

-- ---------------------------------------------------------------------------
-- Statements
-- ---------------------------------------------------------------------------
create table public.partner_rebate_statements (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references public.partners(id) on delete restrict,
  -- "2026-Q4". The statement covers loads paid by period_end that weren't on
  -- an earlier statement, so a load credited late is carried, not lost.
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
  issued_by        uuid references public.profiles(id) on delete set null default auth.uid(),
  sent_at          timestamptz,
  paid_on          date,
  paid_ref         text,
  paid_by          uuid references public.profiles(id) on delete set null,
  notes            text,
  unique (partner_id, quarter),
  constraint partner_rebate_paid_complete check ((status = 'paid') = (paid_on is not null))
);
create index partner_rebate_statements_partner_idx on public.partner_rebate_statements (partner_id, period_end desc);

create table public.partner_rebate_lines (
  id                uuid primary key default gen_random_uuid(),
  statement_id      uuid not null references public.partner_rebate_statements(id) on delete cascade,
  -- Set null (not cascade) if the shipment is later merged away: the line is
  -- a record of what was paid, so it keeps its own copy of the details.
  shipment_id       uuid references public.shipments(id) on delete set null,
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
create unique index partner_rebate_lines_shipment_once on public.partner_rebate_lines (shipment_id) where shipment_id is not null;
create index partner_rebate_lines_statement_idx on public.partner_rebate_lines (statement_id);

-- A load that's on a statement keeps its credit: moving it would leave the
-- statement saying one partner earned it and the shipment saying another.
create or replace function public.guard_partner_credit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.partner_id is distinct from old.partner_id
     and exists (select 1 from public.partner_rebate_lines l where l.shipment_id = old.id) then
    raise exception 'This load is on a rebate statement already, so its partner credit can''t change.'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_shipments_guard_partner_credit
  before update of partner_id on public.shipments
  for each row execute function public.guard_partner_credit();

-- Issue a statement and its lines in one transaction. Runs as the caller, so
-- the admin-only policies below decide who can.
create or replace function public.issue_rebate_statement(
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

  insert into public.partner_rebate_statements (
    partner_id, quarter, period_start, period_end, rebate_pct, commission_basis,
    line_count, billed_total, margin_total, rebate_total
  )
  select p_partner_id, p_quarter, p_period_start, p_period_end, p_rebate_pct, p_commission_basis,
         count(*), sum((l->>'billed')::numeric), sum((l->>'margin')::numeric), sum((l->>'rebate')::numeric)
  from jsonb_array_elements(p_lines) l
  returning id into v_id;

  insert into public.partner_rebate_lines (
    statement_id, shipment_id, tms_reference_id, exhibitor_name, show_name, invoice_nos,
    paid_on, billed, cost, margin, rebate
  )
  select v_id, (l->>'shipment_id')::uuid, l->>'tms_reference_id', l->>'exhibitor_name', l->>'show_name',
         l->>'invoice_nos', (l->>'paid_on')::date, (l->>'billed')::numeric, (l->>'cost')::numeric,
         (l->>'margin')::numeric, (l->>'rebate')::numeric
  from jsonb_array_elements(p_lines) l;

  -- Every line must still be credited to this partner at the moment of issue.
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    join public.shipments s on s.id = (l->>'shipment_id')::uuid
    where s.partner_id is distinct from p_partner_id
  ) then
    raise exception 'A load on this statement is no longer credited to this partner. Reload and try again.'
      using errcode = '23514';
  end if;

  return v_id;
end $$;

revoke all on function public.issue_rebate_statement(uuid, text, date, date, numeric, text, jsonb) from public, anon;
grant execute on function public.issue_rebate_statement(uuid, text, date, date, numeric, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Paid or not, from the Sage AR ledger
--
-- A load's customer invoice is "N<load #>" (and "AN<load #>" for an adjusted
-- one). Paid means every such invoice is in the ledger with a zero balance and
-- a closed date; paid_on is the last close date, Pacific. Anything else is not
-- paid for rebate purposes:
--   open           invoiced, balance still owed
--   not_in_ledger  no invoice in Sage yet (or invoiced before the ledger
--                  extract began on 2026-08-24 - ask AR)
--   no_reference   the shipment has no TMS load number
-- ---------------------------------------------------------------------------
create or replace function public.shipment_ar_status(p_shipment_ids uuid[])
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
  if not public.is_member() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if to_regclass('public.ap_ledger_invoices') is null then
    return query
      select s.id, 'no_ledger'::text, array[]::text[], null::numeric, null::numeric, null::date
      from public.shipments s where s.id = any (p_shipment_ids);
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
    from public.shipments s
    left join public.ap_ledger_invoices g
      on g.side = 'AR'
     and g.invoice_type = 'IN'
     and g.invoice_no in ('N' || btrim(s.tms_reference_id), 'AN' || btrim(s.tms_reference_id))
    where s.id = any (p_shipment_ids)
    group by s.id, s.tms_reference_id;
end $$;

revoke all on function public.shipment_ar_status(uuid[]) from public, anon;
grant execute on function public.shipment_ar_status(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: everyone reads; only admins issue, mark paid or void.
-- ---------------------------------------------------------------------------
alter table public.partner_rebate_statements enable row level security;
alter table public.partner_rebate_lines enable row level security;

create policy members_read on public.partner_rebate_statements
  for select to authenticated using (public.is_member());
create policy admins_insert on public.partner_rebate_statements
  for insert to authenticated with check (public.is_admin());
create policy admins_update on public.partner_rebate_statements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Void = delete, and only while unpaid.
create policy admins_delete_unpaid on public.partner_rebate_statements
  for delete to authenticated using (public.is_admin() and status <> 'paid');

create policy members_read on public.partner_rebate_lines
  for select to authenticated using (public.is_member());
create policy admins_insert on public.partner_rebate_lines
  for insert to authenticated with check (public.is_admin());

grant select, insert, update, delete on public.partner_rebate_statements to authenticated;
grant select, insert on public.partner_rebate_lines to authenticated;
grant all on public.partner_rebate_statements, public.partner_rebate_lines to service_role;
