import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { matchVenue, type VenueLite } from "@/lib/venue-match";
import { resolveShowId, type ShowLite } from "@/lib/tms-link";
import { hyperionShipmentUrl } from "@/lib/tms";
import { formatDate } from "@/lib/format";
import { SuggestionList, type Cluster } from "./suggestion-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Suggestions · DTS Trade Show CRM" };

// Loads at the same venue belong to the same show only if their dates are
// close; freight for one show clusters within a few days. Advance-warehouse
// loads arrive weeks early and are handled as their own group.
const SHOW_GAP_DAYS = 3;
const DAY = 86_400_000;
const AW_RE = /\b(advance|marshall(?:ing)?|warehouse|whse)\b/i;
const STREET_RE =
  /\d{2,6}\s+[A-Za-z0-9.\- ]*?(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pkwy|Parkway|Pl|Place|Ct|Court|Hwy|Highway|Cir|Circle|Ter|Terrace)\b/i;

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterParam } = await searchParams;
  const filter = filterParam === "venue" || filterParam === "show" ? filterParam : "all";
  const supabase = await createClient();
  const [{ data: shipmentsData }, { data: venuesData }, { data: showsData }] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "id, tms_reference_id, tms_customer_id, tms_venue_raw, tms_venue_city, tms_venue_state, booth_number, destination_type, destination_address, venue_id, show_id, pickup_date, show_date, exhibitor:exhibitors(company_name)",
      )
      .not("tms_venue_raw", "is", null)
      .or("venue_id.is.null,show_id.is.null"),
    supabase.from("venues").select("id, venue_name, city, state").order("venue_name"),
    supabase
      .from("shows")
      .select(
        "id, show_name, edition_year, venue_id, archived, move_in_start, move_out_end, show_start_date, show_end_date",
      )
      .eq("archived", false)
      .order("show_name"),
  ]);

  const venues: VenueLite[] = venuesData ?? [];
  const rows = shipmentsData ?? [];
  const showsLite: ShowLite[] = showsData ?? [];

  type Row = (typeof rows)[number];
  const leadingNumber = (raw: string | null) => raw?.match(/\b(\d{2,6})\s+[A-Za-z]/)?.[1] ?? null;
  const groupKey = (r: Row) => {
    const place = `${(r.tms_venue_city ?? "").toLowerCase()}|${(r.tms_venue_state ?? "").toLowerCase()}`;
    const num = leadingNumber(r.tms_venue_raw);
    return num ? `${num}|${place}` : place;
  };
  const streetLabel = (raw: string | null) => raw?.match(STREET_RE)?.[0].replace(/\s+/g, " ").trim() ?? null;
  const isAdvanceWarehouse = (r: Row) =>
    r.destination_type === "advance_warehouse" || AW_RE.test(`${r.tms_venue_raw ?? ""} ${r.destination_address ?? ""}`);
  const loadDate = (r: Row) => (r.show_date ?? r.pickup_date) ?? null;

  // 1) Group every load by venue (street address).
  const venueGroups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = groupKey(r);
    const g = venueGroups.get(key) ?? [];
    g.push(r);
    venueGroups.set(key, g);
  }

  // 2) Within a venue, split direct-to-show loads into shows by date proximity.
  const splitByShowWindow = (loads: Row[]): Row[][] => {
    const dated = loads
      .filter((r) => loadDate(r))
      .sort((a, b) => Date.parse(loadDate(a)!) - Date.parse(loadDate(b)!));
    const undated = loads.filter((r) => !loadDate(r));
    const out: Row[][] = [];
    let cur: Row[] = [];
    let prev = 0;
    for (const r of dated) {
      const t = Date.parse(loadDate(r)!);
      if (cur.length && t - prev > SHOW_GAP_DAYS * DAY) {
        out.push(cur);
        cur = [];
      }
      cur.push(r);
      prev = t;
    }
    if (cur.length) out.push(cur);
    if (undated.length) out.push(undated);
    return out;
  };

  const clusters: Cluster[] = [...venueGroups.values()]
    .map((g) => {
      const venueTexts = [...new Set(g.map((r) => r.tms_venue_raw).filter(Boolean) as string[])];
      const matched = venueTexts.map((t) => matchVenue(t, venues)).find(Boolean) ?? null;
      const exhibitors = [...new Set(g.map((r) => r.exhibitor?.company_name).filter(Boolean) as string[])];
      const matchedVenueId = matched?.id;

      const buildGroup = (loads: Row[], opts: { id: string; aw?: boolean }) => {
        const dateHints = [
          ...new Set(loads.map(loadDate).filter(Boolean).map((d) => (d as string).slice(0, 10))),
        ].sort();
        const dateRangeLabel =
          dateHints.length === 0
            ? null
            : dateHints.length === 1
              ? formatDate(dateHints[0])
              : `${formatDate(dateHints[0])} – ${formatDate(dateHints[dateHints.length - 1])}`;
        const matchedShowId = matchedVenueId ? resolveShowId(matchedVenueId, dateHints[0], showsLite) : undefined;
        const msFull = matchedShowId ? (showsData ?? []).find((sh) => sh.id === matchedShowId) : undefined;
        const matchedShow = msFull
          ? { id: msFull.id, name: `${msFull.show_name}${msFull.edition_year ? ` ${msFull.edition_year}` : ""}` }
          : null;
        return {
          id: opts.id,
          isAdvanceWarehouse: !!opts.aw,
          label: opts.aw ? "Advance warehouse" : (dateRangeLabel ?? "Dates unknown"),
          dateRangeLabel,
          loadIds: loads.map((r) => r.id),
          count: loads.length,
          needsShow: loads.filter((r) => !r.show_id).length,
          matchedShow,
          shipments: loads
            .map((r) => ({
              id: r.id,
              ref: r.tms_reference_id,
              tmsUrl: hyperionShipmentUrl(r.tms_customer_id, r.tms_reference_id),
              venueRaw: r.tms_venue_raw,
              booth: r.booth_number,
              exhibitor: r.exhibitor?.company_name ?? null,
              date: loadDate(r)?.slice(0, 10) ?? null,
              hasVenue: !!r.venue_id,
              hasShow: !!r.show_id,
            }))
            .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
        };
      };

      const awLoads = g.filter(isAdvanceWarehouse);
      const directLoads = g.filter((r) => !isAdvanceWarehouse(r));
      const groups = [
        ...splitByShowWindow(directLoads).map((loads, i) => buildGroup(loads, { id: `d${i}` })),
        ...(awLoads.length ? [buildGroup(awLoads, { id: "aw", aw: true })] : []),
      ];

      return {
        city: g[0].tms_venue_city,
        state: g[0].tms_venue_state,
        addressLabel: g.map((r) => streetLabel(r.tms_venue_raw)).find(Boolean) ?? null,
        shipmentIds: g.map((r) => r.id),
        count: g.length,
        venueTexts,
        exhibitors,
        matchedVenue: matched ? { id: matched.id, name: matched.venue_name } : null,
        needsVenue: g.filter((r) => !r.venue_id).length,
        groups,
      };
    })
    .sort((a, b) => b.count - a.count);

  const venueOptions = venues
    .map((vn) => ({
      id: vn.id,
      label: `${vn.venue_name}${vn.city ? ` — ${vn.city}${vn.state ? `, ${vn.state}` : ""}` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const showOptions = (showsData ?? []).map((sh) => ({
    id: sh.id,
    label: `${sh.show_name}${sh.edition_year ? ` ${sh.edition_year}` : ""}`,
    venueId: sh.venue_id,
  }));

  // Split the work into two jobs so the operator can focus on one at a time:
  // clusters whose loads still need a VENUE, vs. clusters (venue already
  // linked) whose date groups still need a SHOW.
  const wantsVenue = (c: Cluster) => c.needsVenue > 0;
  const wantsShow = (c: Cluster) => c.groups.some((gr) => gr.needsShow > 0);
  const tabs = [
    { key: "all", label: "All", count: clusters.length },
    { key: "venue", label: "Needs venue", count: clusters.filter(wantsVenue).length },
    { key: "show", label: "Needs show", count: clusters.filter(wantsShow).length },
  ] as const;
  const shown =
    filter === "venue"
      ? clusters.filter(wantsVenue)
      : filter === "show"
        ? clusters.filter(wantsShow)
        : clusters;

  return (
    <div>
      <PageHeader
        title="Suggestions"
        description="Loads grouped by venue, then by show date. Assign a venue, then a show to each date group — search your records or the web."
      />

      {clusters.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-1">
          {tabs.map((t) => {
            const active = filter === t.key;
            const href = t.key === "all" ? "/suggestions" : `/suggestions?filter=${t.key}`;
            return (
              <Link
                key={t.key}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-dts-maroon text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {clusters.length === 0 ? (
        <Card>
          <EmptyState
            icon="sparkles"
            title="Nothing to suggest right now"
            description="When new TMS shipments arrive that aren't linked to a venue or show, they'll be grouped here."
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon="sparkles"
            title={filter === "venue" ? "No venues to assign" : "No shows to assign"}
            description={
              filter === "venue"
                ? "Every clustered load already has a venue. Switch to “Needs show” to assign shows."
                : "Every clustered load already has a show. Switch to “Needs venue” to assign venues."
            }
          />
        </Card>
      ) : (
        <SuggestionList clusters={shown} venues={venueOptions} shows={showOptions} />
      )}
    </div>
  );
}
