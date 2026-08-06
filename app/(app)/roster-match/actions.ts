"use server";

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

export type MatchRow = { input: string; matched: MatchedExhibitor | null };

export type RosterState = {
  results: MatchRow[];
  total: number;
  matchedCount: number;
  error: string | null;
};

// Legal-entity noise stripped before comparing company names.
const SUFFIXES = new Set([
  "inc", "incorporated", "llc", "llp", "lp", "corp", "corporation", "co",
  "company", "ltd", "limited", "group", "gmbh", "ag", "oa", "usa", "na", "the",
]);

/** Normalize a company name to a comparison key (order-preserving, de-noised). */
function normCompany(s: string): string {
  let t = s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parentheticals like "(OA)"
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.startsWith("the ")) t = t.slice(4);
  const toks = t.split(" ").filter(Boolean);
  while (toks.length > 1 && SUFFIXES.has(toks[toks.length - 1])) toks.pop();
  return toks.join("");
}

export async function matchRoster(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const raw = String(formData.get("names") ?? "");
  // One company per line; take the part before the first tab (spreadsheet copy).
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const name = line.split("\t")[0].trim();
    if (!name) continue;
    const dedupe = name.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    names.push(name);
    if (names.length >= 5000) break;
  }

  if (names.length === 0) {
    return { results: [], total: 0, matchedCount: 0, error: "Paste or upload a list of company names (one per line)." };
  }

  const supabase = await createClient();
  const exhibitors = await fetchAll<MatchedExhibitor>(() =>
    supabase
      .from("exhibitors")
      .select("id, company_name, priority_tier, sales_status, owner_rep, legacy_loads, legacy_margin"),
  );

  const byKey = new Map<string, MatchedExhibitor>();
  for (const e of exhibitors) {
    const k = normCompany(e.company_name);
    if (k && !byKey.has(k)) byKey.set(k, e);
  }

  const results: MatchRow[] = names.map((input) => ({
    input,
    matched: byKey.get(normCompany(input)) ?? null,
  }));
  const matchedCount = results.filter((r) => r.matched).length;

  return { results, total: results.length, matchedCount, error: null };
}
