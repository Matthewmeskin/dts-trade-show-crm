#!/usr/bin/env node
/**
 * One-time importer: load the legacy trade-show customer master into the CRM as
 * enriched exhibitors + per-show history.
 *
 * Run AFTER applying migration 0035_exhibitor_sales_book.sql.
 *
 * Usage:
 *   node scripts/import-legacy-customers.mjs --dry-run   # report only, no writes
 *   node scripts/import-legacy-customers.mjs             # perform the import
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment (or .env.local). The service-role key is required because RLS
 * gates the exhibitors table to authenticated users; this runs server-side.
 *
 * Idempotent: matches existing exhibitors by normalized company name (enriches
 * them) and inserts the rest, then replaces each exhibitor's show history. Safe
 * to re-run.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

// --- env: prefer real env, fall back to .env.local ------------------------
function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set them in .env.local or the environment before running.",
  );
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- helpers ---------------------------------------------------------------
const normName = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

async function fetchAllExhibitors() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("exhibitors")
      .select("id, company_name, source")
      .range(from, from + 999);
    if (error) throw new Error(`fetch exhibitors: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Sales/roll-up fields we always refresh from the legacy snapshot.
function salesFields(c) {
  return {
    sales_status: c.sales_status,
    priority_tier: c.priority_tier,
    priority_tier_label: c.priority_tier_label,
    ttm_loads: c.ttm_loads,
    ttm_margin: c.ttm_margin,
    last_pickup: c.last_pickup,
    legacy_loads: c.legacy_loads,
    legacy_first_year: c.legacy_first_year,
    legacy_last_year: c.legacy_last_year,
    legacy_billed: c.legacy_billed,
    legacy_margin: c.legacy_margin,
    legacy_margin_per_load: c.legacy_margin_per_load,
    shows_shipped: c.shows_shipped,
    shows_confirmed_2026: c.shows_confirmed_2026,
    top_show_cities: c.top_show_cities,
    imported_at: new Date().toISOString(),
  };
}

async function main() {
  const data = JSON.parse(
    readFileSync(resolve(__dirname, "data", "legacy-customers.json"), "utf8"),
  );
  console.log(
    `Loaded ${data.length} legacy companies (${data.filter((c) => c.history.length).length} with show history).`,
  );
  console.log(DRY_RUN ? "DRY RUN — no writes.\n" : "Live import.\n");

  const existing = await fetchAllExhibitors();
  const byName = new Map(existing.map((e) => [normName(e.company_name), e]));
  console.log(`Existing exhibitors in CRM: ${existing.length}`);

  let matched = 0;
  let inserted = 0;
  let historyRows = 0;

  for (const c of data) {
    const key = normName(c.company_name);
    const hit = byName.get(key);
    let exhibitorId;

    if (hit) {
      matched++;
      exhibitorId = hit.id;
      if (!DRY_RUN) {
        const patch = salesFields(c);
        // Don't clobber app-entered contact details — only fill blanks.
        const cur = await supabase
          .from("exhibitors")
          .select("owner_rep, website, primary_contact_phone")
          .eq("id", exhibitorId)
          .single();
        const e = cur.data ?? {};
        if (!e.owner_rep && c.owner_rep) patch.owner_rep = c.owner_rep;
        if (!e.website && c.website) patch.website = c.website;
        if (!e.primary_contact_phone && c.phone) patch.primary_contact_phone = c.phone;
        const { error } = await supabase
          .from("exhibitors")
          .update(patch)
          .eq("id", exhibitorId);
        if (error) throw new Error(`update ${c.company_name}: ${error.message}`);
      }
    } else {
      inserted++;
      if (!DRY_RUN) {
        const { data: ins, error } = await supabase
          .from("exhibitors")
          .insert({
            company_name: c.company_name,
            owner_rep: c.owner_rep,
            website: c.website,
            primary_contact_phone: c.phone,
            source: "legacy_import",
            ...salesFields(c),
          })
          .select("id")
          .single();
        if (error) throw new Error(`insert ${c.company_name}: ${error.message}`);
        exhibitorId = ins.id;
        byName.set(key, { id: exhibitorId, company_name: c.company_name });
      }
    }

    // Replace this exhibitor's show history (idempotent).
    if (!DRY_RUN && exhibitorId && c.history.length) {
      const rows = c.history
        .filter((h) => h.show_name)
        .map((h) => ({ exhibitor_id: exhibitorId, ...h }));
      const { error } = await supabase
        .from("exhibitor_show_history")
        .upsert(rows, { onConflict: "exhibitor_id,show_name" });
      if (error) throw new Error(`history ${c.company_name}: ${error.message}`);
    }
    historyRows += c.history.filter((h) => h.show_name).length;
  }

  console.log("\n--- Summary ---");
  console.log(`Enriched existing exhibitors: ${matched}`);
  console.log(`Newly inserted exhibitors:    ${inserted}`);
  console.log(`Show-history rows:            ${historyRows}`);
  console.log(DRY_RUN ? "\n(dry run — nothing was written)" : "\nDone.");
}

main().catch((err) => {
  console.error("\nImport failed:", err.message);
  process.exit(1);
});
