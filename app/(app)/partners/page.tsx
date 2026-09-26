import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { dayOf, formatDate, formatShortDate, todayYMD } from "@/lib/format";
import { PARTNER_TYPES, STAGES, TIERS, labelOf } from "@/lib/partners";
import { PartnersNav, StageBadge, TierBadge, WeeklyStrip, loadWeeklyNumbers } from "./parts";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const selectClass =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";

type Search = {
  q?: string;
  tier?: string;
  type?: string;
  stage?: string;
  owner?: string;
  archived?: string;
  page?: string;
};

export default async function PartnersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { q = "", tier = "", type = "", stage = "", owner = "", archived = "" } = sp;
  const supabase = await createClient();
  const today = todayYMD();

  let query = supabase
    .from("partners")
    .select("id, name, partner_type, tier, city, state, client_count, stage, admin_id, rep_id, next_step, next_step_on, archived")
    .eq("archived", archived === "1")
    .order("tier", { ascending: true, nullsFirst: false })
    .order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (tier) query = tier === "none" ? query.is("tier", null) : query.eq("tier", Number(tier));
  if (type) query = query.eq("partner_type", type);
  if (stage) query = query.eq("stage", stage);
  if (owner) query = query.or(`admin_id.eq.${owner},rep_id.eq.${owner}`);

  const [{ data: partners }, { data: profiles }, { data: links }, { data: signals }, { data: touches }, week] =
    await Promise.all([
      query.limit(2000),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("partner_shows").select("partner_id, client_count, shows(show_name, show_start_date)").limit(5000),
      supabase.from("partner_signals").select("partner_id").is("worked_at", null).limit(5000),
      supabase.from("partner_touches").select("partner_id, occurred_at").order("occurred_at", { ascending: false }).limit(5000),
      loadWeeklyNumbers(supabase),
    ]);

  const people = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || "—"]));
  const nextShow = new Map<string, { name: string; start: string; clients: number | null }>();
  for (const l of links ?? []) {
    const s = l.shows;
    if (!s?.show_start_date || s.show_start_date < today) continue;
    const cur = nextShow.get(l.partner_id);
    if (!cur || s.show_start_date < cur.start) {
      nextShow.set(l.partner_id, { name: s.show_name, start: s.show_start_date, clients: l.client_count });
    }
  }
  const openSignals = new Map<string, number>();
  for (const s of signals ?? []) openSignals.set(s.partner_id, (openSignals.get(s.partner_id) ?? 0) + 1);
  const lastTouch = new Map<string, string>();
  for (const t of touches ?? []) if (!lastTouch.has(t.partner_id)) lastTouch.set(t.partner_id, t.occurred_at);

  const rows = partners ?? [];
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pageCount);
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, tier, type, stage, owner, archived })) if (v) params.set(k, v);
    if (p > 1) params.set("page", String(p));
    return `/partners${params.toString() ? `?${params}` : ""}`;
  };
  const filtered = !!(q || tier || type || stage || owner || archived);

  const byTier = [1, 2, 3].map((t) => rows.filter((r) => r.tier === t).length);

  return (
    <div>
      <PageHeader
        title="Partners"
        description="Exhibit houses, regional GSCs, organizers and agencies that control freight for many exhibitors. Win one, earn their book."
        actions={
          <Link
            href="/partners/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New partner
          </Link>
        }
      />
      <PartnersNav active="list" />
      <WeeklyStrip n={week} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {total} {archived === "1" ? "archived" : "on the list"}
          {!filtered && total ? (
            <span className="text-slate-400">
              {" "}
              · Tier 1: {byTier[0]} · Tier 2: {byTier[1]} · Tier 3: {byTier[2]}
            </span>
          ) : null}
        </p>
        <form className="flex flex-wrap items-center gap-2">
          <select name="tier" defaultValue={tier} className={selectClass} aria-label="Tier">
            <option value="">All tiers</option>
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
            <option value="none">Untiered</option>
          </select>
          <select name="type" defaultValue={type} className={selectClass} aria-label="Type">
            <option value="">All types</option>
            {PARTNER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.short}
              </option>
            ))}
          </select>
          <select name="stage" defaultValue={stage} className={selectClass} aria-label="Status">
            <option value="">Any status</option>
            {STAGES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select name="owner" defaultValue={owner} className={selectClass} aria-label="Owner">
            <option value="">Anyone</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search partners…"
            className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
          {archived ? <input type="hidden" name="archived" value={archived} /> : null}
          <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Filter
          </button>
          {filtered ? (
            <Link href="/partners" className="text-sm font-medium text-slate-400 hover:text-slate-700">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="users"
            title={filtered ? "No partners match" : "No partners yet"}
            description={
              filtered
                ? "Try a different filter."
                : "Import the tiered target list from a spreadsheet, or add partners one at a time."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Partner</th>
                  <th className="px-3 py-3">Tier</th>
                  <th className="px-3 py-3">Clients</th>
                  <th className="px-3 py-3">Next show</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Next step</th>
                  <th className="px-3 py-3">Last touch</th>
                  <th className="px-5 py-3">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedRows.map((p) => {
                  const ns = nextShow.get(p.id);
                  const sig = openSignals.get(p.id) ?? 0;
                  const last = lastTouch.get(p.id);
                  const stepLate = p.next_step_on && p.next_step_on < today;
                  return (
                    <LinkRow key={p.id} href={`/partners/${p.id}`} className="group align-top hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/partners/${p.id}`} className="font-medium text-slate-900 group-hover:text-dts-maroon">
                          {p.name}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {labelOf(PARTNER_TYPES.map((t) => ({ value: t.value, label: t.short })), p.partner_type)}
                          {p.city || p.state ? ` · ${[p.city, p.state].filter(Boolean).join(", ")}` : ""}
                        </div>
                        {sig ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                            {sig} new signal{sig === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <TierBadge tier={p.tier} />
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">{p.client_count ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {ns ? (
                          <>
                            <div>{ns.name}</div>
                            <div className="text-xs text-slate-400">
                              {formatShortDate(ns.start)}
                              {ns.clients ? ` · ${ns.clients} clients` : ""}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StageBadge stage={p.stage} />
                      </td>
                      <td className="max-w-56 px-3 py-3 text-slate-600">
                        {p.next_step ? <div className="line-clamp-2">{p.next_step}</div> : <span className="text-slate-400">—</span>}
                        {p.next_step_on ? (
                          <div className={`text-xs ${stepLate ? "font-medium text-dts-maroon" : "text-slate-400"}`}>
                            {stepLate ? "Overdue · " : ""}
                            {formatDate(p.next_step_on)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{last ? formatShortDate(dayOf(last)) : "Never"}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {p.admin_id ? <div>Admin: {people.get(p.admin_id)}</div> : null}
                        {p.rep_id ? <div>Rep: {people.get(p.rep_id)}</div> : null}
                        {!p.admin_id && !p.rep_id ? "—" : null}
                      </td>
                    </LinkRow>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} makeHref={pageHref} />
          </div>
        )}
      </Card>
      <p className="mt-3 text-right text-xs">
        <Link
          href={archived === "1" ? "/partners" : "/partners?archived=1"}
          className="font-medium text-slate-400 hover:text-slate-700"
        >
          {archived === "1" ? "Back to the list" : "Show archived"}
        </Link>
      </p>
    </div>
  );
}
