import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatDateRange, todayYMD } from "@/lib/format";
import { effectiveStatus } from "@/lib/logistics";
import { shipShowStatus } from "@/lib/ship-center";
import { standing } from "@/lib/ship-intake";
import { StartPicker } from "./panels";

export const dynamic = "force-dynamic";

/**
 * GSC Shipping Centers. Kept apart from Show pages on purpose: Show pages is
 * the queue of DTS's own public SEO pages; this is where a GSC's exhibitor
 * shipping portal is set up, one GSC at a time.
 */
export default async function ShipCentersPage() {
  const supabase = await createClient();
  const today = todayYMD();

  const [{ data: gscs }, { data: rows }, { data: open }] = await Promise.all([
    supabase
      .from("partners")
      .select("id, name, public_name, code")
      .eq("partner_type", "gsc")
      .eq("archived", false)
      .order("name"),
    supabase
      .from("ship_shows")
      .select("partner_id, show_id, enabled, shows(show_name, show_start_date, show_end_date)"),
    supabase.from("ship_request_inbox").select("closed, ship_request_legs(stage, own_carrier, direction)").is("closed", null),
  ]);
  const toDo = (open ?? []).filter((r) => {
    const k = standing(r.closed, r.ship_request_legs ?? []).key;
    return k === "quote" || k === "book";
  }).length;

  const showIds = [...new Set((rows ?? []).map((r) => r.show_id))];
  const { data: logistics } = showIds.length
    ? await supabase.from("show_public_logistics").select("show_id, verification_status, last_verified_at").in("show_id", showIds)
    : { data: [] as { show_id: string; verification_status: string; last_verified_at: string | null }[] };
  const logBy = new Map((logistics ?? []).map((l) => [l.show_id, l]));

  const byGsc = new Map<string, NonNullable<typeof rows>>();
  for (const r of rows ?? []) byGsc.set(r.partner_id, [...(byGsc.get(r.partner_id) ?? []), r]);

  const running = (gscs ?? [])
    .filter((g) => byGsc.has(g.id))
    .map((g) => {
      const shows = (byGsc.get(g.id) ?? []).map((r) => ({
        ...r,
        status: shipShowStatus(r.enabled, effectiveStatus(logBy.get(r.show_id) ?? null, r.shows?.show_end_date ?? null), r.shows?.show_end_date ?? null, today),
      }));
      const upcoming = shows
        .filter((s) => s.status.state !== "past")
        .sort((a, b) => (a.shows?.show_start_date ?? "9999").localeCompare(b.shows?.show_start_date ?? "9999"));
      return {
        ...g,
        on: upcoming.filter((s) => s.status.state === "on").length,
        todo: upcoming.filter((s) => s.status.action && s.status.action !== "turn_off").length,
        next: upcoming[0] ?? null,
        total: upcoming.length,
      };
    });
  const notStarted = (gscs ?? []).filter((g) => !byGsc.has(g.id)).map((g) => ({ id: g.id, name: g.public_name || g.name }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="GSC Shipping Centers"
        description="Each GSC gets a shipping page for its exhibitors, one per show it runs. Add the GSC's shows, check each one against the exhibitor kit, then turn it on."
      />

      <Link
        href="/ship-centers/requests"
        className={`mb-6 flex items-center justify-between rounded-2xl border px-5 py-4 text-sm ${toDo ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
      >
        <span>
          <span className="font-semibold">Exhibitor requests: </span>
          {toDo ? `${toDo} need${toDo === 1 ? "s" : ""} a price or a booking` : "nothing to do right now"}
        </span>
        <span>Open →</span>
      </Link>

      <Card className="mb-6">
        <CardHeader title="Running a Shipping Center" icon="truck" />
        {running.length ? (
          <ul className="divide-y divide-slate-100">
            {running.map((g) => (
              <li key={g.id}>
                <Link href={`/ship-centers/${g.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{g.public_name || g.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {g.total} upcoming show{g.total === 1 ? "" : "s"}
                      {g.next?.shows ? ` · next: ${g.next.shows.show_name}, ${formatDateRange(g.next.shows.show_start_date, g.next.shows.show_end_date)}` : ""}
                    </div>
                  </div>
                  {g.on ? <Badge className="bg-emerald-100 text-emerald-800">{g.on} on</Badge> : null}
                  {g.todo ? <Badge className="bg-amber-100 text-amber-800">{g.todo} to do</Badge> : null}
                  <span className="text-sm text-slate-400">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="truck" title="No Shipping Centers yet" description="Start one for a GSC below." />
        )}
      </Card>

      <Card>
        <CardHeader title="Start one for a GSC" icon="plus" />
        <div className="space-y-2 p-5">
          <p className="text-sm text-slate-500">
            Only independent GSCs, for shows they run themselves. A GSC has to be a partner first (type GSC).
          </p>
          <StartPicker gscs={notStarted} />
        </div>
      </Card>
    </div>
  );
}
