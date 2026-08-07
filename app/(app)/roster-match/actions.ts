"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";

export type MatchedExhibitor = {
  id: string;
  company_name: string;
  priority_tier: string | null;
  sales_status: string | null;
  owner_rep: string | null;
  legacy_loads: number | null;
  legacy_margin: number | null;
};

/** A hit in the general customer master (freight customer, may have no show history). */
export type MatchedCustomer = {
  id: string;
  company_name: string;
  owner_rep: string | null;
  city: string | null;
  state: string | null;
};

/** Prior shipping history for the selected show, if any. */
export type ShowHistory = { loads: number; first: number | null; last: number | null };

export type MatchRow = {
  input: string;
  matched: MatchedExhibitor | null;   // trade-show exhibitor/customer
  customer: MatchedCustomer | null;   // freight customer (only when no exhibitor match)
  history: ShowHistory | null;
};

export type RosterState = {
  results: MatchRow[];
  total: number;
  matchedCount: number;   // trade-show exhibitor matches
  customerCount: number;  // freight-customer-only matches
  show: string;
  error: string | null;
};

const SUFFIXES = new Set([
  "inc", "incorporated", "llc", "llp", "lp", "corp", "corporation", "co",
  "company", "ltd", "limited", "group", "gmbh", "ag", "oa", "usa", "na", "the",
]);

function normCompany(s: string): string {
  let t = s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.startsWith("the ")) t = t.slice(4);
  const toks = t.split(" ").filter(Boolean);
  while (toks.length > 1 && SUFFIXES.has(toks[toks.length - 1])) toks.pop();
  return toks.join("");
}

function parseNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const name = line.split("\t")[0].trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= 5000) break;
  }
  return names;
}

export async function matchRoster(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const show = String(formData.get("show") ?? "").trim();
  const names = parseNames(String(formData.get("names") ?? ""));

  if (names.length === 0) {
    return { results: [], total: 0, matchedCount: 0, customerCount: 0, show, error: "Paste or upload a list of company names (one per line)." };
  }

  const supabase = await createClient();
  const [exhibitors, customers] = await Promise.all([
    fetchAll<MatchedExhibitor>(() =>
      supabase
        .from("exhibitors")
        .select("id, company_name, priority_tier, sales_status, owner_rep, legacy_loads, legacy_margin"),
    ),
    fetchAll<MatchedCustomer>(() =>
      supabase.from("customers").select("id, company_name, owner_rep, city, state"),
    ),
  ]);

  const byKey = new Map<string, MatchedExhibitor>();
  for (const e of exhibitors) {
    const k = normCompany(e.company_name);
    if (k && !byKey.has(k)) byKey.set(k, e);
  }
  const byKeyCustomer = new Map<string, MatchedCustomer>();
  for (const c of customers) {
    const k = normCompany(c.company_name);
    if (k && !byKeyCustomer.has(k)) byKeyCustomer.set(k, c);
  }

  // Prior history for the chosen show: aggregate that show's rows per exhibitor.
  const historyByExhibitor = new Map<string, ShowHistory>();
  if (show) {
    const rows = await fetchAll<{ exhibitor_id: string; show_loads: number | null; first_year: number | null; last_year: number | null }>(
      () =>
        supabase
          .from("exhibitor_show_history")
          .select("exhibitor_id, show_loads, first_year, last_year")
          .eq("canonical_show_name", show),
    );
    for (const r of rows) {
      const cur = historyByExhibitor.get(r.exhibitor_id) ?? { loads: 0, first: null, last: null };
      cur.loads += r.show_loads ?? 0;
      if (r.first_year != null) cur.first = cur.first == null ? r.first_year : Math.min(cur.first, r.first_year);
      if (r.last_year != null) cur.last = cur.last == null ? r.last_year : Math.max(cur.last, r.last_year);
      historyByExhibitor.set(r.exhibitor_id, cur);
    }
  }

  const results: MatchRow[] = names.map((input) => {
    const key = normCompany(input);
    const matched = byKey.get(key) ?? null;
    // Only surface a freight-customer hit when there's no trade-show match.
    const customer = matched ? null : byKeyCustomer.get(key) ?? null;
    return {
      input,
      matched,
      customer,
      history: matched ? historyByExhibitor.get(matched.id) ?? null : null,
    };
  });
  const matchedCount = results.filter((r) => r.matched).length;
  const customerCount = results.filter((r) => r.customer).length;

  return { results, total: results.length, matchedCount, customerCount, show, error: null };
}

export type RecordState = { saved: number; error: string | null };

/** Save the matched customers as the authoritative 2026 roster for a show. */
export async function recordRoster(_prev: RecordState, formData: FormData): Promise<RecordState> {
  const show = String(formData.get("show") ?? "").trim();
  const ids = String(formData.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!show) return { saved: 0, error: "Enter the show name first." };
  if (ids.length === 0) return { saved: 0, error: "No matched customers to save." };

  const supabase = await createClient();
  const rows = ids.map((exhibitor_id) => ({ show_name: show, year: 2026, exhibitor_id, source: "roster_upload" }));
  const { error } = await supabase
    .from("exhibitor_show_roster")
    .upsert(rows, { onConflict: "show_name,year,exhibitor_id" });
  if (error) return { saved: 0, error: error.message };

  revalidatePath("/show-history");
  return { saved: ids.length, error: null };
}
