import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { formatDate, formatDateRange, formatPacificDateTime } from "@/lib/format";
import type { Cadence } from "@/lib/gsc-manifest";
import { linkShipmentToShow, markManifestSent } from "../../actions";
import { loadManifest, loadManifestOptions } from "../../manifest-data";
import { ReportActions } from "../report/report-actions";

export const dynamic = "force-dynamic";

const CADENCE: Record<Cadence, { label: string; badge: string }> = {
  weekly: { label: "Inbound · weekly", badge: "bg-sky-50 text-sky-700" },
  daily: { label: "Inbound · daily", badge: "bg-amber-100 text-amber-800" },
  outbound: { label: "Outbound · daily", badge: "bg-violet-100 text-violet-800" },
  none: { label: "Not yet", badge: "bg-slate-100 text-slate-500" },
};

/**
 * The GSC manifest for one show they service: inbound before the show,
 * outbound from opening day. Built from every DTS load linked to the show, so
 * it's for GSCs only - their warehouse receives that freight anyway. The rep
 * checks it, sends it, logs it.
 */
export default async function ManifestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ps?: string }>;
}) {
  const { id } = await params;
  const { ps } = await searchParams;
  const supabase = await createClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("name, public_name, partner_type, rep_id, report_to")
    .eq("id", id)
    .maybeSingle();
  if (!partner) notFound();

  const crumbs = [
    { label: "Partners", href: "/partners" },
    { label: partner.name, href: `/partners/${id}` },
  ];

  if (partner.partner_type !== "gsc") {
    return (
      <div>
        <PageHeader title="GSC manifest" breadcrumbs={crumbs} />
        <Card className="p-5 text-sm text-slate-600">
          The manifest lists every DTS load to a show, so it only goes to a general service contractor, whose warehouse
          receives that freight anyway. For a builder, organizer or agency, use the{" "}
          <Link href={`/partners/${id}/report`} className="font-medium text-dts-maroon hover:underline">
            weekly client report
          </Link>
          , which covers only their own clients.
        </Card>
      </div>
    );
  }

  const options = await loadManifestOptions(supabase, id);
  if (!options.length) {
    return (
      <div>
        <PageHeader title="GSC manifest" breadcrumbs={crumbs} />
        <Card className="p-5 text-sm text-slate-600">
          Link the shows this GSC services under <strong>Shows</strong> on the{" "}
          <Link href={`/partners/${id}`} className="font-medium text-dts-maroon hover:underline">
            partner page
          </Link>
          .
        </Card>
      </div>
    );
  }
  const selected =
    options.find((o) => o.partnerShowId === ps) ?? options.find((o) => o.cadence !== "none") ?? options[0];
  const { manifest, candidates } = await loadManifest(supabase, partner, selected);
  const s = selected.show;

  return (
    <div>
      <PageHeader
        title={manifest.kind === "outbound" ? "GSC outbound list" : "GSC inbound manifest"}
        description={`${partner.public_name ?? partner.name} · ${s.show_name} · ${formatDateRange(s.show_start_date, s.show_end_date)}`}
        breadcrumbs={crumbs}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {options.map((o) => (
          <Link
            key={o.partnerShowId}
            href={`/partners/${id}/manifest?ps=${o.partnerShowId}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${o.partnerShowId === selected.partnerShowId ? "border-dts-maroon bg-dts-maroon/5 font-medium text-dts-maroon" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {o.show.show_name}
            <Badge className={`ml-2 ${CADENCE[o.cadence].badge}`}>{CADENCE[o.cadence].label}</Badge>
            {o.due ? <span className="ml-1.5 text-xs font-semibold text-dts-maroon">due</span> : null}
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title={manifest.subject} icon="documents" />
          <div className="p-3">
            <iframe
              title="Manifest preview"
              srcDoc={`<!doctype html><html><body style="margin:12px;background:#fff">${manifest.html}</body></html>`}
              sandbox=""
              className="h-[760px] w-full rounded-lg border border-slate-100 bg-white"
            />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3 p-5 text-sm">
            <div>
              <div className="text-xs text-slate-400">To</div>
              <div className="text-slate-800">
                {partner.report_to ?? (
                  <span className="text-amber-700">
                    Nobody set —{" "}
                    <Link href={`/partners/${id}`} className="underline">
                      add who gets reports
                    </Link>
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {manifest.totals.loads} load{manifest.totals.loads === 1 ? "" : "s"} · {manifest.totals.pieces} pcs ·{" "}
              {manifest.totals.weight.toLocaleString("en-US")} lbs.{" "}
              {selected.cadence === "none" ? "Not in its sending window yet." : `Cadence: ${CADENCE[selected.cadence].label.toLowerCase()}.`}
            </div>
            <ReportActions html={manifest.html} text={manifest.text} subject={manifest.subject} to={partner.report_to} />
            <form action={markManifestSent} className="border-t border-slate-100 pt-3">
              <input type="hidden" name="partner_show_id" value={selected.partnerShowId} />
              <input type="hidden" name="partner_id" value={id} />
              <input type="hidden" name="kind" value={manifest.kind} />
              <input type="hidden" name="show_name" value={s.show_name} />
              <button type="submit" className="rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark">
                I sent it — log it
              </button>
              <p className="mt-1.5 text-xs text-slate-400">
                {selected.sentAt ? `Last sent ${formatPacificDateTime(selected.sentAt)}.` : "Not sent yet."}
              </p>
            </form>
          </Card>

          {manifest.needsCheck.length ? (
            <Card className="space-y-2 border-amber-300 p-5 text-xs text-slate-600">
              <h3 className="text-sm font-semibold text-amber-800">Check {manifest.needsCheck.length} load{manifest.needsCheck.length === 1 ? "" : "s"} in the TMS</h3>
              <p>Still showing as moving well past their dates, so they&apos;re left off until updated.</p>
              <ul className="space-y-1">
                {manifest.needsCheck.map((n, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-800">{n.exhibitor}</span> — {n.status}
                    {n.pickup ? `, pickup ${formatDate(n.pickup)}` : ""}
                    {n.pro ? ` · PRO ${n.pro}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {manifest.kind === "inbound" && manifest.outboundMissing.length ? (
            <Card className="space-y-2 p-5 text-xs text-slate-600">
              <h3 className="text-sm font-semibold text-slate-900">No outbound booked yet ({manifest.outboundMissing.length})</h3>
              <p>Shipping in with us, nothing booked out. That&apos;s the call to make before teardown.</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {manifest.outboundMissing.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={`Possible loads for ${s.show_name} (${candidates.length})`} icon="search" />
            <div className="space-y-2 p-5 text-xs text-slate-600">
              <p>
                Not linked to any show, but in this show&apos;s freight window and headed to its venue, warehouse or site. Link
                the ones that belong and they join the manifest.
              </p>
              {candidates.length ? (
                <ul className="divide-y divide-slate-100">
                  {candidates.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-2 py-2">
                      <div>
                        <Link href={`/shipments/${c.id}`} className="font-medium text-slate-800 hover:text-dts-maroon">
                          {c.exhibitor}
                        </Link>
                        <div>
                          {c.direction === "move_out" ? "Outbound" : "Inbound"} · {c.status}
                          {c.pickup ? ` · pickup ${formatDate(c.pickup)}` : ""}
                          {c.to ? ` · to ${c.to}` : ""}
                        </div>
                        <div className="text-slate-400">{c.reason}</div>
                      </div>
                      <form action={linkShipmentToShow}>
                        <input type="hidden" name="shipment_id" value={c.id} />
                        <input type="hidden" name="show_id" value={s.id} />
                        <input type="hidden" name="partner_id" value={id} />
                        <button type="submit" className="whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100">
                          Link
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400">None found.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
