import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { matchVenue, type VenueLite } from "@/lib/venue-match";
import { formatDate } from "@/lib/format";
import { SuggestionList, type Cluster } from "./suggestion-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Suggestions · DTS Trade Show CRM" };

type GroupMode = "show" | "venue";

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const sp = await searchParams;
  const groupMode: GroupMode = sp.group === "venue" ? "venue" : "show";
  const supabase = await createClient();
  const [{ data: shipmentsData }, { data: venuesData }] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "id, tms_reference_id, tms_venue_raw, tms_venue_city, tms_venue_state, booth_number, venue_id, show_id, pickup_date, show_date, exhibitor:exhibitors(company_name)",
      )
      .not("tms_venue_raw", "is", null)
      .or("venue_id.is.null,show_id.is.null"),
    supabase.from("venues").select("id, venue_name, city, state").order("venue_name"),
  ]);

  const venues: VenueLite[] = venuesData ?? [];
  const rows = shipmentsData ?? [];

  // Group by street address, not just city: different addresses in the same city
  // are usually different venues/shows (e.g. the convention center vs. a
  // marshalling yard vs. an advance warehouse). Key on the leading house number
  // + city/state so name typos and "c/o" suffixes don't split a real address.
  const leadingNumber = (raw: string | null) => raw?.match(/\b(\d{2,6})\s+[A-Za-z]/)?.[1] ?? null;
  const groupKey = (r: (typeof rows)[number]) => {
    const place = `${(r.tms_venue_city ?? "").toLowerCase()}|${(r.tms_venue_state ?? "").toLowerCase()}`;
    const num = leadingNumber(r.tms_venue_raw);
    return num ? `${num}|${place}` : place;
  };
  // A concise "123 Main St" label for the cluster heading.
  const STREET_RE =
    /\d{2,6}\s+[A-Za-z0-9.\- ]*?(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pkwy|Parkway|Pl|Place|Ct|Court|Hwy|Highway|Cir|Circle|Ter|Terrace)\b/i;
  const streetLabel = (raw: string | null) => raw?.match(STREET_RE)?.[0].replace(/\s+/g, " ").trim() ?? null;

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = groupKey(r);
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  // "By show" mode splits each venue's loads into shows by date: a venue hosts
  // many shows a year, so loads whose dates are more than ~6 weeks apart are
  // almost certainly different shows. Undated loads ride with the first window.
  const DAY = 86_400_000;
  const SHOW_GAP_DAYS = 45;
  const loadDate = (r: (typeof rows)[number]) => Date.parse((r.show_date ?? r.pickup_date) ?? "");
  function splitByShowWindow(g: typeof rows): (typeof rows)[] {
    const dated = g.filter((r) => Number.isFinite(loadDate(r))).sort((a, b) => loadDate(a) - loadDate(b));
    const undated = g.filter((r) => !Number.isFinite(loadDate(r)));
    if (dated.length === 0) return [g];
    const out: (typeof rows)[] = [];
    let cur: typeof rows = [];
    let prev = loadDate(dated[0]);
    for (const r of dated) {
      if (cur.length && loadDate(r) - prev > SHOW_GAP_DAYS * DAY) {
        out.push(cur);
        cur = [];
      }
      cur.push(r);
      prev = loadDate(r);
    }
    out.push(cur);
    if (undated.length) out[0].push(...undated);
    return out;
  }

  const finalGroups =
    groupMode === "show" ? [...groups.values()].flatMap(splitByShowWindow) : [...groups.values()];

  const clusters: Cluster[] = finalGroups
    .map((g) => {
      const venueTexts = [...new Set(g.map((r) => r.tms_venue_raw).filter(Boolean) as string[])];
      const matched = venueTexts.map((t) => matchVenue(t, venues)).find(Boolean) ?? null;
      const exhibitors = [...new Set(g.map((r) => r.exhibitor?.company_name).filter(Boolean) as string[])];
      const dateHints = [...new Set(
        g.flatMap((r) => [r.show_date, r.pickup_date]).filter(Boolean).map((d) => (d as string).slice(0, 10)),
      )].sort();
      const dateRangeLabel =
        dateHints.length === 0
          ? null
          : dateHints.length === 1
            ? formatDate(dateHints[0])
            : `${formatDate(dateHints[0])} – ${formatDate(dateHints[dateHints.length - 1])}`;
      return {
        city: g[0].tms_venue_city,
        state: g[0].tms_venue_state,
        addressLabel: g.map((r) => streetLabel(r.tms_venue_raw)).find(Boolean) ?? null,
        dateRangeLabel,
        shipmentIds: g.map((r) => r.id),
        count: g.length,
        venueTexts,
        exhibitors,
        dateHints,
        matchedVenue: matched ? { id: matched.id, name: matched.venue_name } : null,
        needsVenue: g.filter((r) => !r.venue_id).length,
        needsShow: g.filter((r) => !r.show_id).length,
        // Per-load detail so the operator can confirm which loads belong to a
        // show before linking — one city often holds several different shows.
        shipments: g
          .map((r) => ({
            id: r.id,
            ref: r.tms_reference_id,
            venueRaw: r.tms_venue_raw,
            booth: r.booth_number,
            exhibitor: r.exhibitor?.company_name ?? null,
            date: (r.show_date ?? r.pickup_date)?.slice(0, 10) ?? null,
            hasVenue: !!r.venue_id,
            hasShow: !!r.show_id,
          }))
          .sort((a, b) => (a.venueRaw ?? "").localeCompare(b.venueRaw ?? "")),
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader
        title="Suggestions"
        description="Venues and shows inferred from your TMS shipments — match, or create with AI and auto-link."
      />
      {clusters.length > 0 ? (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Group by</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
            <Link
              href="/suggestions?group=show"
              className={`rounded-md px-3 py-1.5 transition ${groupMode === "show" ? "bg-dts-maroon text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Show
            </Link>
            <Link
              href="/suggestions?group=venue"
              className={`rounded-md px-3 py-1.5 transition ${groupMode === "venue" ? "bg-dts-maroon text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Venue
            </Link>
          </div>
          <span className="text-xs text-slate-400">
            {groupMode === "show"
              ? "Split each venue into separate shows by date."
              : "All loads at one venue grouped together."}
          </span>
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
      ) : (
        <SuggestionList clusters={clusters} />
      )}
    </div>
  );
}
