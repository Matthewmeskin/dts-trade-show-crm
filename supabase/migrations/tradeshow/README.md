# Migrations as applied to DTS Database (`tradeshow` schema)

The CRM runs on DTS Database (`qshciqxpkirlkmrwucnk`) in the `tradeshow` schema. The numbered files
one folder up are written against `public` for a standalone CRM project and refuse to run where
`public.ap_ledger_invoices` exists (DTS Database's `public` schema is payables).

This folder is the record of what actually ran on DTS Database: each file is the exact SQL of one
applied migration, recovered from `supabase_migrations.schema_migrations`, named
`<applied version>_<applied name>.sql`. They are not meant to be re-run.

| Applied | Repo file it corresponds to |
| --- | --- |
| `tradeshow_crm_part1_core`, `_part2_features`, `_part3_recent` | 0001 to 0035 (the cutover, Aug 28 2026) |
| `tradeshow_show_status_uses_show_dates` | show status fix at cutover |
| `tradeshow_carrier_quote_number` | 0036 |
| `tradeshow_show_status_pacific_day` | 0037 |
| `tradeshow_week_before_sent` | 0038 |
| `tradeshow_start_call_done` | 0039 |
| `tradeshow_0040_partners` to `tradeshow_0045_public_sync_runs` | 0040 to 0045 |
| `tradeshow_0044b_ar_status_null_amount` | the `nullif` change folded into 0044 |
| `tradeshow_0046_ship_shows` | 0046, GSC Shipping Center slice 2 (Sept 27 2026) |
| `tradeshow_0047_ship_intake` | 0047, GSC Shipping Center slice 4: the requests inbox (Sept 28 2026) |
| `tradeshow_0048_app_settings` | 0048, GSC Shipping Center slice 3: the app settings table (partner tools switch) (Sept 28 2026) |
| `tradeshow_0049_ship_status` | 0049, GSC Shipping Center slice 5: exhibitor versions, pushed statuses, change requests (Sept 28 2026) |

The export side (`tradeshow_public` views, `show_series`, `show_public_logistics`, `public_export()`)
lives in `dts-sage/trade-show/crm/migrations`, not here.

**From migration 0046 on**, every CRM change lands as two files in the same PR: the guarded `public`
file one folder up, and its `tradeshow` variant here, applied only after Matthew has seen the SQL and
point in time recovery is confirmed. Never the `public` schema on DTS Database.
