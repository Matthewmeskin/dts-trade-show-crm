-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260927015534 "tradeshow_0043_partner_show_manifest_sent".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

alter table tradeshow.partner_shows add column if not exists manifest_sent_at timestamptz;
