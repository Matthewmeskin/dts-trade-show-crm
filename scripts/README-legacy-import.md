# Legacy trade-show customer import

One-time load of the legacy customer master (`DTS_Trade_Show_Master.xlsx`) into
the CRM as enriched **exhibitors** + per-show history.

## What it does

- Adds sales-book fields to each exhibitor: owner/rep, sales status
  (active / dormant / not_in_tms), priority tier (A–D / Internal), website, and
  historical roll-ups (TTM + lifetime loads, billed, margin, last pickup).
- Loads the per-customer, per-show shipping history into
  `exhibitor_show_history` (shown on each exhibitor's page).
- **Dedupes by company name** (case-insensitive): existing exhibitors are
  enriched in place; the rest are inserted with `source = 'legacy_import'`.
  App-entered owner/website/phone are only filled when blank — never clobbered.
- Idempotent: safe to re-run (history is upserted, not duplicated).

Source counts: **871 companies**, **1,526 show-history rows** (596 companies
have history).

## Steps

1. **Apply the migration** `supabase/migrations/0035_exhibitor_sales_book.sql`
   to the CRM database (e.g. `supabase db push`, or paste it into the Supabase
   SQL editor).

2. **Set credentials.** The importer needs the CRM project's URL + service-role
   key (RLS gates the tables; the service key runs server-side). Put them in
   `.env.local` (already used by the app) or the environment:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<crm-project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

3. **Dry run** (no writes — prints how many would be enriched vs. inserted):

   ```
   node scripts/import-legacy-customers.mjs --dry-run
   ```

4. **Import:**

   ```
   node scripts/import-legacy-customers.mjs
   ```

## Regenerating the data file

`scripts/data/legacy-customers.json` was generated from the master workbook with
`scripts/build-legacy-data.py`. To rebuild it from an updated workbook:

```
pip install openpyxl
python scripts/build-legacy-data.py /path/to/DTS_Trade_Show_Master.xlsx scripts/data/legacy-customers.json
```
