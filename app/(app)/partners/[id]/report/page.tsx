import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { partnerToolsOn } from "@/lib/app-settings";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { dayOf, formatDate, formatPacificDateTime } from "@/lib/format";
import { weekStart } from "@/lib/partners";
import { markReportSent } from "../../actions";
import { loadPartnerReport } from "../../report-data";
import { ReportActions } from "./report-actions";

export const dynamic = "force-dynamic";

/**
 * This week's client freight report for one partner, ready to check and send.
 * The CRM writes it; a rep reads it and sends it from their own mailbox.
 */
export default async function PartnerReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // Partner growth tooling: gone unless an admin has it on (lib/app-settings.ts).
  if (!(await partnerToolsOn(supabase))) notFound();
  const { data: partner } = await supabase
    .from("partners")
    .select("name, report_to, report_active, last_report_sent_at")
    .eq("id", id)
    .maybeSingle();
  if (!partner) notFound();
  const loaded = await loadPartnerReport(supabase, id);
  if (!loaded) notFound();
  const { report, clientCount, pilotCount } = loaded;
  const sentThisWeek = !!partner.last_report_sent_at && (dayOf(partner.last_report_sent_at) ?? "") >= weekStart();

  return (
    <div>
      <PageHeader
        title="Weekly client freight report"
        description={`${partner.name} · week of ${formatDate(report.weekOf)}`}
        breadcrumbs={[
          { label: "Partners", href: "/partners" },
          { label: partner.name, href: `/partners/${id}` },
        ]}
      />

      {clientCount === 0 ? (
        <Card className="p-5 text-sm text-slate-600">
          No clients linked yet. Add this partner&apos;s exhibitors under <strong>Clients</strong> on the{" "}
          <Link href={`/partners/${id}`} className="font-medium text-dts-maroon hover:underline">
            partner page
          </Link>{" "}
          and their freight shows up here.
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader title={report.subject} icon="documents" />
            <div className="p-3">
              <iframe
                title="Report preview"
                srcDoc={`<!doctype html><html><body style="margin:12px;background:#fff">${report.html}</body></html>`}
                sandbox=""
                className="h-[900px] w-full rounded-lg border border-slate-100 bg-white"
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
                        add who gets it
                      </Link>
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {clientCount} client{clientCount === 1 ? "" : "s"} linked{pilotCount ? `, ${pilotCount} in the pilot` : ""}.
              </div>
              <ReportActions html={report.html} text={report.text} subject={report.subject} to={partner.report_to} />
              <form action={markReportSent} className="border-t border-slate-100 pt-3">
                <input type="hidden" name="partner_id" value={id} />
                <input type="hidden" name="week_of" value={report.weekOf} />
                <button
                  type="submit"
                  className="rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark"
                >
                  {sentThisWeek ? "Sent again — log it" : "I sent it — log it"}
                </button>
                <p className="mt-1.5 text-xs text-slate-400">
                  {partner.last_report_sent_at
                    ? `Last sent ${formatPacificDateTime(partner.last_report_sent_at)}.`
                    : "Not sent yet."}{" "}
                  Logging it counts as an email touch and clears it from the worklist until Monday.
                </p>
              </form>
            </Card>

            {report.needsCheck.length ? (
              <Card className="space-y-2 border-amber-300 p-5 text-xs text-slate-600">
                <h3 className="text-sm font-semibold text-amber-800">
                  Check {report.needsCheck.length} load{report.needsCheck.length === 1 ? "" : "s"} in the TMS
                </h3>
                <p>
                  These still show as moving well after their dates, so the TMS is probably behind. They&apos;re left out of
                  the email until they&apos;re updated.
                </p>
                <ul className="space-y-1">
                  {report.needsCheck.map((n, i) => (
                    <li key={i}>
                      <span className="font-medium text-slate-800">{n.client}</span> — {n.kind}, {n.status}
                      {n.pickup ? `, pickup ${formatDate(n.pickup)}` : ""}
                      {n.pro ? ` · PRO ${n.pro}` : ""}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card className="space-y-2 p-5 text-xs text-slate-500">
              <h3 className="text-sm font-semibold text-slate-900">Before it goes out</h3>
              <ul className="list-disc space-y-1 pl-4">
                <li>Statuses come from the TMS sync. If a load moved today, check it in the TMS first.</li>
                <li>The report never shows notes, costs, margins or carrier rates.</li>
                <li>
                  &ldquo;Outbound not booked yet&rdquo; lists every client at a show in the next 60 days with no outbound
                  booked. Call those out when you send it — that&apos;s the win.
                </li>
                <li>Clients only appear if their exhibitor is linked under Clients on the partner page.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
