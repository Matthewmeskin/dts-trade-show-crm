-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260927004955 "tradeshow_0042_partner_cobrand_terms".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

alter table tradeshow.partners
  add column if not exists code text,
  add column if not exists public_name text,
  add column if not exists logo_url text,
  add column if not exists cobrand_active boolean not null default false,
  add column if not exists incentive_model text,
  add column if not exists rebate_pct numeric(5,2),
  add column if not exists markup_pct numeric(6,2),
  add column if not exists commission_basis text,
  add column if not exists terms_note text;

alter table tradeshow.partners
  add constraint partners_code_shape check (code is null or code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(code) between 3 and 40),
  add constraint partners_logo_https check (logo_url is null or logo_url ~ '^https://'),
  add constraint partners_cobrand_needs_code check (not cobrand_active or (code is not null and public_name is not null)),
  add constraint partners_incentive_model check (incentive_model is null or incentive_model in ('rebate', 'markup')),
  add constraint partners_rebate_pct check (rebate_pct is null or rebate_pct between 0 and 100),
  add constraint partners_markup_pct check (markup_pct is null or markup_pct between 0 and 500),
  add constraint partners_commission_basis check (commission_basis is null or commission_basis in ('before_rebate', 'after_rebate'));

create unique index if not exists partners_code_unique on tradeshow.partners (code) where code is not null;

alter table tradeshow.partner_shows
  add column if not exists cobranded boolean not null default false;
