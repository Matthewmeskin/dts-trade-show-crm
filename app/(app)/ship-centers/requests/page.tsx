import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatPacificDateTime } from "@/lib/format";
import { STANDING_TONE, standing, type RequestStanding } from "@/lib/ship-intake";
import { CheckNowButton } from "./panels";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "open", label: "To do" },
  { key: "waiting", label: "Waiting on exhibitor" },
  { key: "booked", label: "Booked" },
  { key: "closed", label: "Closed" },
] as const;
type View = (typeof VIEWS)[number]["key"];

function inView(view: View, s: RequestStanding): boolean {
  if (view === "open") return s.key === "quote" || s.key === "book";
  if (view === "waiting") return s.key === "waiting";
  if (view === "booked") return s.key === "booked";
  return s.key === "closed";
}

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : formatPacificDateTime(iso);
};

/**
 * Requests from GSC Shipping Centers, pulled from the public project every 15
 * minutes. "To do" is anything that needs a person: a price to send, or an
 * approved quote to book.
 */
export default async function ShipRequestsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: raw } = await searchParams;
  const view: View = VIEWS.some((v) => v.key === raw) ? (raw as View) : "open";
  const supabase = await createClient();

  const [{ data: rows }, { data: pull }, { data: people }] = await Promise.all([
    supabase
      .from("ship_request_inbox")
      .select("id, public_ref, show_snapshot, company, booth, booth_tbd, confirmed_at, received_at, problems, closed, assigned_to, ship_request_legs(stage, own_carrier, direction)")
      .order("confirmed_at", { ascending: true })
      .limit(500),
    supabase.from("ship_pull_state").select("last_run_at, last_ok_at, last_error, last_count").eq("id", 1).maybeSingle(),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name ?? "Someone"]));

  const all = (rows ?? []).map((r) => ({ ...r, s: standing(r.closed, r.ship_request_legs ?? []) }));
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, all.filter((r) => inView(v.key, r.s)).length])) as Record<View, number>;
  // To do: oldest first (it has waited longest). Everything else: newest first.
  const list = all.filter((r) => inView(view, r.s));
  if (view !== "open") list.reverse();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Shipping Center requests"
        description="Exhibitor requests from GSC Shipping Centers. Price each shipment, then book it with the load number once the exhibitor approves."
        breadcrumbs={[{ label: "GSC Shipping Centers", href: "/ship-centers" }]}
        actions={<CheckNowButton />}
      />

      <p className="-mt-3 mb-4 text-xs text-slate-500">
        Checked for new requests {ago(pull?.last_run_at ?? null)}.
        {pull?.last_error ? <span className="ml-1 text-dts-maroon">Last check failed: {pull.last_error}</span> : null}
      </p>

      <nav className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/ship-centers/requests?view=${v.key}`}
            className={`flex-1 rounded-md px-3 py-1.5 text-center font-medium transition ${view === v.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {v.label}
            {counts[v.key] ? <span className="ml-1.5 text-xs text-slate-400">{counts[v.key]}</span> : null}
          </Link>
        ))}
      </nav>

      <Card>
        {list.length ? (
          <ul className="divide-y divide-slate-100">
            {list.map((r) => {
              const show = (r.show_snapshot ?? {}) as Record<string, unknown>;
              const legs = r.ship_request_legs ?? [];
              const out = legs.some((l) => l.direction === "outbound");
              const ins = legs.filter((l) => l.direction === "inbound").length;
              return (
                <li key={r.id}>
                  <Link href={`/ship-centers/requests/${r.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-slate-900">{r.company ?? "Company removed"}</span>
                        <span className="text-sm text-slate-500">{r.booth_tbd ? "booth TBD" : r.booth ? `booth ${r.booth}` : ""}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono">{r.public_ref}</span> · {String(show.show_name ?? "Show")} {String(show.year ?? "")} ·{" "}
                        {String(show.gsc_name ?? "")} · {[out ? "Outbound" : null, ins ? `Inbound${ins > 1 ? ` ×${ins}` : ""}` : null].filter(Boolean).join(" + ")}
                      </div>
                    </div>
                    {r.problems?.length ? <Badge className="bg-rose-50 text-rose-700">{r.problems.length} to check</Badge> : null}
                    <Badge className={STANDING_TONE[r.s.key]}>{r.s.label}</Badge>
                    <span className="w-28 text-right text-xs text-slate-400">
                      {r.assigned_to ? nameOf.get(r.assigned_to) : "Unassigned"}
                      <span className="block">{ago(r.confirmed_at ?? r.received_at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="truck"
            title={view === "open" ? "Nothing to do" : "Nothing here"}
            description={view === "open" ? "New requests show up here within 15 minutes of an exhibitor confirming." : undefined}
          />
        )}
      </Card>
    </div>
  );
}
