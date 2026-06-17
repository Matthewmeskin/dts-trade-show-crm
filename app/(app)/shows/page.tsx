import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SHOW_STATUS_META, type ShowStatus } from "@/lib/shows";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "", q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("shows_with_status")
    .select("*")
    .order("move_in_start", { ascending: true, nullsFirst: false });

  if (STATUS_TABS.some((t) => t.value === status && t.value !== "")) {
    query = query.eq("status", status as ShowStatus);
  }
  if (q.trim()) {
    query = query.ilike("show_name", `%${q.trim()}%`);
  }

  const [{ data: shows }, { data: venues }] = await Promise.all([
    query,
    supabase.from("venues").select("id, venue_name, city, state"),
  ]);

  const venueById = new Map((venues ?? []).map((v) => [v.id, v]));
  const rows = shows ?? [];

  return (
    <div>
      <PageHeader
        title="Shows"
        description="Every trade show your division is handling."
        actions={
          <Link
            href="/shows/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New show
          </Link>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => {
            const active = status === t.value;
            const params = new URLSearchParams();
            if (t.value) params.set("status", t.value);
            if (q) params.set("q", q);
            const href = `/shows${params.toString() ? `?${params}` : ""}`;
            return (
              <Link
                key={t.label}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-dts-maroon text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <form className="relative">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search shows…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
          />
        </form>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="shows"
            title={q || status ? "No shows match" : "No shows yet"}
            description={
              q || status
                ? "Try a different filter or search term."
                : "Create your first show to get started."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Show</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Start</th>
                  <th className="px-5 py-3">End</th>
                  <th className="px-5 py-3">Venue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((s) => {
                  const meta = SHOW_STATUS_META[s.status ?? "upcoming"];
                  const venue = s.venue_id ? venueById.get(s.venue_id) : null;
                  return (
                    <tr key={s.id} className="group hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link
                          href={`/shows/${s.id}`}
                          className="font-medium text-slate-900 group-hover:text-dts-maroon"
                        >
                          {s.show_name}
                        </Link>
                        {s.edition_year ? (
                          <span className="ml-1.5 text-slate-400">
                            {s.edition_year}
                          </span>
                        ) : null}
                        {s.industry_vertical ? (
                          <div className="text-xs text-slate-400">
                            {s.industry_vertical}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={meta.badge}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatDate(s.show_start_date)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatDate(s.show_end_date)}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {venue ? (
                          <>
                            {venue.venue_name}
                            {venue.city ? (
                              <span className="text-slate-400">
                                {" "}
                                · {venue.city}
                                {venue.state ? `, ${venue.state}` : ""}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
