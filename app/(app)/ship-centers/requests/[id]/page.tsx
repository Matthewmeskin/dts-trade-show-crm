import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { formatDate, formatPacificDateTime } from "@/lib/format";
import { STANDING_TONE, legName, quotable, standing } from "@/lib/ship-intake";
import { emailConfigured, money } from "@/lib/ship-quote";
import { assignToMe, cancelLeg, markChangeHandled } from "../actions";
import { BookForm, CloseForm, QuotePanel, type QuoteLeg } from "../panels";

export const dynamic = "force-dynamic";

const LOCATION: Record<string, string> = {
  business_dock: "Business with a dock",
  business_no_dock: "Business, no dock",
  residential: "Residence",
  limited_access: "Limited access",
  trade_show: "Another show or venue",
};
const STAGE: Record<string, string> = {
  new: "Needs a price",
  quoted: "Quoted",
  approved: "Approved by the exhibitor: book it",
  booked: "Booked",
  cancelled: "Cancelled",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}

export default async function ShipRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase.from("ship_request_inbox").select("*, ship_request_legs(*)").eq("id", id).maybeSingle();
  if (!r) notFound();

  const legs = [...(r.ship_request_legs ?? [])].sort((a, b) =>
    a.direction === b.direction ? a.seq - b.seq : a.direction === "outbound" ? -1 : 1,
  );
  const legIds = legs.map((l) => l.id);
  const { data: claims } = await supabase.auth.getClaims();
  const meId = (claims?.claims?.sub as string | undefined) ?? null;
  const [{ data: quotes }, { data: loads }, { data: people }, { data: changes }] = await Promise.all([
    legIds.length
      ? supabase.from("ship_quotes").select("leg_id, amount, sent_via, sent_at, sent_by, note").in("leg_id", legIds).order("sent_at", { ascending: false })
      : Promise.resolve({ data: [] as { leg_id: string; amount: number; sent_via: string; sent_at: string; sent_by: string | null; note: string | null }[] }),
    legIds.length
      ? supabase.from("shipments").select("id, ship_leg_id, tms_reference_id, pro_number, status, carriers(carrier_name)").in("ship_leg_id", legIds)
      : Promise.resolve({ data: [] as { id: string; ship_leg_id: string | null; tms_reference_id: string | null; pro_number: string | null; status: string; carriers: { carrier_name: string } | null }[] }),
    supabase.from("profiles").select("id, full_name, phone"),
    supabase.from("ship_change_requests").select("*").eq("request_id", id).order("requested_at"),
  ]);
  const openChanges = (changes ?? []).filter((c) => !c.handled_at);
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name ?? "Someone"]));
  const meProfile = (people ?? []).find((p) => p.id === meId);
  const lastQuote = new Map<string, NonNullable<typeof quotes>[number]>();
  for (const q of quotes ?? []) if (!lastQuote.has(q.leg_id)) lastQuote.set(q.leg_id, q);
  const loadOf = new Map((loads ?? []).map((s) => [s.ship_leg_id, s]));

  const show = (r.show_snapshot ?? {}) as Record<string, unknown>;
  const inbound = legs.filter((l) => l.direction === "inbound").length;
  const s = standing(r.closed, legs, openChanges.length);
  const toPrice = legs.filter((l) => quotable(l) && (l.stage === "new" || l.stage === "quoted"));
  const quoteLegs: QuoteLeg[] = toPrice.map((l) => ({
    id: l.id,
    name: legName(l.direction, l.seq, inbound),
    direction: l.direction,
    city: l.city,
    state: l.state,
    inbound_to: l.inbound_to,
    pieces: l.pieces,
    weight_lbs: l.weight_lbs,
    packaging: l.packaging,
    liftgate: l.liftgate,
    inside: l.inside,
    last: lastQuote.get(l.id)?.amount ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${r.company ?? "Company removed"}${r.booth_tbd ? ", booth TBD" : r.booth ? `, booth ${r.booth}` : ""}`}
        description={`${r.public_ref} · ${String(show.show_name ?? "Show")} ${String(show.year ?? "")} · ${String(show.gsc_name ?? "")} · confirmed ${formatPacificDateTime(r.confirmed_at)}`}
        breadcrumbs={[
          { label: "GSC Shipping Centers", href: "/ship-centers" },
          { label: "Requests", href: "/ship-centers/requests" },
        ]}
        actions={<Badge className={STANDING_TONE[s.key]}>{s.label}</Badge>}
      />

      {r.problems?.length ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Check before quoting</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {r.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.closed ? (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {r.closed === "rejected" ? "Turned down" : "Cancelled"} {formatPacificDateTime(r.closed_at)}
          {r.closed_by ? ` by ${nameOf.get(r.closed_by)}` : ""}.{r.closed_note ? ` ${r.closed_note}` : ""}
        </div>
      ) : null}

      {(changes ?? []).length ? (
        <Card className={`mb-5 ${openChanges.length ? "border-rose-200" : ""}`}>
          <CardHeader title={openChanges.length ? "The exhibitor asked for a change" : "Change requests"} icon="bell" />
          <ul className="divide-y divide-slate-100">
            {(changes ?? []).map((c) => (
              <li key={c.id} className="space-y-2 px-5 py-3 text-sm">
                <p className="whitespace-pre-line text-slate-900">{c.message}</p>
                <p className="text-xs text-slate-500">Sent {formatPacificDateTime(c.requested_at)}</p>
                {c.handled_at ? (
                  <p className="text-xs text-emerald-700">
                    Handled {formatPacificDateTime(c.handled_at)}
                    {c.handled_by ? ` by ${nameOf.get(c.handled_by)}` : ""}
                    {c.handled_note ? `: ${c.handled_note}` : ""}
                  </p>
                ) : (
                  <form action={markChangeHandled} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="change_id" value={c.id} />
                    <input name="handled_note" placeholder="What you did (staff only)" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                    <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Mark handled</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {legs.map((l) => {
            const q = lastQuote.get(l.id);
            const load = loadOf.get(l.id);
            return (
              <Card key={l.id}>
                <CardHeader
                  title={`${legName(l.direction, l.seq, inbound)}${l.direction === "outbound" ? ": after the show" : l.inbound_to === "direct" ? ": to the show site" : ": to the advance warehouse"}`}
                  icon="truck"
                  action={<span className="text-xs font-medium text-slate-500">{l.own_carrier ? "Own carrier, labels only" : STAGE[l.stage]}</span>}
                />
                <dl className="px-5 py-3">
                  <Row label={l.direction === "outbound" ? "Deliver to" : "Pick up at"}>
                    {[l.place_name, l.street1, l.street2].filter(Boolean).join(", ")}, {l.city}, {l.state} {l.zip}
                    <span className="block text-xs text-slate-500">
                      {LOCATION[l.location_type ?? ""] ?? l.location_type}
                      {l.liftgate ? " · liftgate" : ""}
                      {l.inside ? " · inside" : ""}
                    </span>
                  </Row>
                  <Row label="Freight">
                    {l.pieces} pc, {l.weight_lbs?.toLocaleString("en-US")} lb, {l.packaging}
                    {l.largest_l_in ? ` · largest ${l.largest_l_in}×${l.largest_w_in ?? "?"}×${l.largest_h_in ?? "?"} in` : ""}
                    {l.description ? <span className="block text-xs text-slate-500">{l.description}</span> : null}
                    {l.hazmat ? <span className="block text-xs font-semibold text-dts-maroon">Marked hazardous</span> : null}
                  </Row>
                  {l.direction === "inbound" ? (
                    <Row label="Ready">{l.ready_date ? formatDate(l.ready_date) : "Not given"}</Row>
                  ) : (
                    <>
                      <Row label="On-site contact">
                        {l.onsite_contact_name ?? "Not given"}
                        {l.onsite_contact_mobile ? (
                          <a href={`tel:${l.onsite_contact_mobile}`} className="ml-2 text-dts-blue hover:underline">
                            {l.onsite_contact_mobile}
                          </a>
                        ) : null}
                      </Row>
                      <Row label="Arrive by">{l.deliver_by ? formatDate(l.deliver_by) : "No date given"}</Row>
                      <Row label="If no check in">{l.return_to_warehouse ? "Return to the GSC's warehouse (agreed)" : "Not agreed"}</Row>
                    </>
                  )}
                  {q ? (
                    <Row label="Quoted">
                      {money(Number(q.amount))} · {q.sent_via === "email" ? "emailed" : "sent from own mailbox"} {formatPacificDateTime(q.sent_at)}
                      {q.sent_by ? ` by ${nameOf.get(q.sent_by)}` : ""}
                    </Row>
                  ) : null}
                  {l.approved_at ? <Row label="Approved">{formatPacificDateTime(l.approved_at)} on their status page</Row> : null}
                  {load ? (
                    <Row label="Load">
                      <Link href={`/shipments/${load.id}`} className="font-mono text-dts-blue hover:underline">
                        {load.tms_reference_id}
                      </Link>
                      {load.carriers?.carrier_name ? ` · ${load.carriers.carrier_name}` : ""}
                      {load.pro_number ? ` · PRO ${load.pro_number}` : ""} · {load.status}
                    </Row>
                  ) : null}
                </dl>
                {!r.closed && !l.own_carrier && l.stage !== "booked" && l.stage !== "cancelled" ? (
                  <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 px-5 py-3">
                    {l.stage === "quoted" || l.stage === "approved" ? <BookForm legId={l.id} /> : <span className="text-xs text-slate-400">Price it below, then book it here once they approve.</span>}
                    <form action={cancelLeg}>
                      <input type="hidden" name="leg_id" value={l.id} />
                      <button className="text-xs text-slate-400 hover:text-dts-maroon">Cancel this shipment</button>
                    </form>
                  </div>
                ) : null}
              </Card>
            );
          })}

          {!r.closed && quoteLegs.length && r.email ? (
            <Card>
              <CardHeader title={quoteLegs.some((l) => l.last) ? "Send a new price" : "Send the price"} icon="sparkles" />
              <QuotePanel
                requestId={r.id}
                legs={quoteLegs}
                email={r.email}
                emailReady={emailConfigured()}
                context={{
                  publicRef: r.public_ref,
                  showName: String(show.show_name ?? "your show"),
                  year: String(show.year ?? ""),
                  gscName: String(show.gsc_name ?? "the show's general service contractor"),
                  booth: r.booth,
                  contactName: r.contact_name,
                  staffName: meProfile?.full_name ?? null,
                  staffPhone: meProfile?.phone ?? null,
                }}
              />
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Exhibitor" icon="exhibitors" />
            <dl className="px-5 py-3">
              <Row label="Contact">{r.contact_name ?? "Removed"}</Row>
              <Row label="Email">{r.email ? <a href={`mailto:${r.email}`} className="text-dts-blue hover:underline">{r.email}</a> : "Removed"}</Row>
              <Row label="Mobile">{r.mobile ? <a href={`tel:${r.mobile}`} className="text-dts-blue hover:underline">{r.mobile}</a> : "Removed"}</Row>
              {r.on_behalf_of ? <Row label="On behalf of">{r.on_behalf_of}</Row> : null}
              {r.declared_value ? <Row label="Declared value">{money(Number(r.declared_value))}</Row> : null}
              <Row label="Coverage quote">{r.wants_coverage ? "Yes, wants one" : "No"}</Row>
              <Row label="Marketing">{r.marketing_consent ? "Opted in to everyday freight emails" : "No"}</Row>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Who has it" icon="users" />
            <div className="space-y-2 px-5 py-3 text-sm">
              <p className="text-slate-700">{r.assigned_to ? nameOf.get(r.assigned_to) : "Nobody yet"}</p>
              {r.assigned_to !== meId && !r.closed ? (
                <form action={assignToMe}>
                  <input type="hidden" name="request_id" value={r.id} />
                  <button className="text-sm font-medium text-dts-blue hover:underline">Take it</button>
                </form>
              ) : null}
            </div>
          </Card>
          {!r.closed ? (
            <Card className="px-5 py-4">
              <CloseForm requestId={r.id} />
            </Card>
          ) : null}
          {r.show_id ? (
            <Link href={`/shows/${r.show_id}`} className="block text-sm text-dts-blue hover:underline">
              Open the show in the CRM →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
