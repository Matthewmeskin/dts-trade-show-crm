import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { matchVenue, type VenueLite } from "@/lib/venue-match";
import { SuggestionList, type Cluster } from "./suggestion-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Suggestions · DTS Trade Show CRM" };

export default async function SuggestionsPage() {
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

  // Group by city|state — a venue cluster.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${(r.tms_venue_city ?? "").toLowerCase()}|${(r.tms_venue_state ?? "").toLowerCase()}`;
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  const clusters: Cluster[] = [...groups.values()]
    .map((g) => {
      const venueTexts = [...new Set(g.map((r) => r.tms_venue_raw).filter(Boolean) as string[])];
      const matched = venueTexts.map((t) => matchVenue(t, venues)).find(Boolean) ?? null;
      const exhibitors = [...new Set(g.map((r) => r.exhibitor?.company_name).filter(Boolean) as string[])];
      const dateHints = [...new Set(
        g.flatMap((r) => [r.show_date, r.pickup_date]).filter(Boolean).map((d) => (d as string).slice(0, 10)),
      )].sort();
      return {
        city: g[0].tms_venue_city,
        state: g[0].tms_venue_state,
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
