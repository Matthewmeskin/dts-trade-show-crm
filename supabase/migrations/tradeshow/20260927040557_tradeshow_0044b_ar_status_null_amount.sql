-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260927040557 "tradeshow_0044b_ar_status_null_amount".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

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
      nullif(sum(g.invoice_amt), 0),
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
