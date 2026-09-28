import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { formatPacificDateTime } from "@/lib/format";
import { buildShipManifest } from "@/lib/ship-manifest";
import { loadShowMail, manifestInput } from "@/lib/ship-mailer";
import { emailList } from "@/lib/ship-quote";
import { localDay } from "@/lib/ship-reminders";
import { SendNow } from "./send-button";

export const dynamic = "force-dynamic";

/**
 * What the GSC gets for this show, exactly as it is emailed: the inbound
 * manifest or the outbound list. With who it goes to, whether the schedule is
 * on, what has gone out, and Send now.
 */
export default async function ShipManifestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; showId: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id, showId } = await params;
  const kind = (await searchParams).kind === "outbound" ? "outbound" : "inbound";
  const supabase = await createClient();
  const [{ data: gsc }, { data: show }, { data: ship }, { data: log }] = await Promise.all([
    supabase.from("partners").select("name, public_name, ship_email, ship_manifest_to").eq("id", id).maybeSingle(),
    supabase.from("shows").select("show_name, edition_year, show_start_date").eq("id", showId).maybeSingle(),
    supabase.from("ship_shows").select("manifest_email, outbound_email").eq("partner_id", id).eq("show_id", showId).maybeSingle(),
    supabase
      .from("ship_email_log")
      .select("kind, sent_to, subject, ok, error, sent_at, sent_by")
      .eq("show_id", showId)
      .in("kind", ["manifest", "outbound_list"])
      .order("sent_at", { ascending: false })
      .limit(20),
  ]);
  if (!gsc || !show || !ship) notFound();

  // The service role reads the requests the same way the schedule does, so
  // the preview is exactly what would be sent.
  const data = await loadShowMail(createAdminClient(), showId, id);
  const gscName = gsc.public_name || gsc.name;
  const m = buildShipManifest({
    kind,
    gscName,
    showName: show.show_name,
    year: show.edition_year ?? (show.show_start_date ?? "").slice(0, 4),
    today: localDay(data.timezone),
    requests: manifestInput(data),
  });
  const to = emailList(gsc.ship_manifest_to || gsc.ship_email);
  const scheduled = kind === "inbound" ? ship.manifest_email === "weekly_then_daily" : ship.outbound_email;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${kind === "inbound" ? "Inbound manifest" : "Outbound list"}: ${show.show_name}`}
        description={`What ${gscName} gets by email. ${scheduled ? "The schedule is on for this show." : "The schedule is off for this show; turn it on in the show's setup."}`}
        breadcrumbs={[
          { label: "GSC Shipping Centers", href: "/ship-centers" },
          { label: gscName, href: `/ship-centers/${id}` },
          { label: show.show_name, href: `/ship-centers/${id}/shows/${showId}` },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`?kind=inbound`}
          className={`rounded-lg px-3 py-1.5 font-medium ${kind === "inbound" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Inbound manifest
        </Link>
        <Link
          href={`?kind=outbound`}
          className={`rounded-lg px-3 py-1.5 font-medium ${kind === "outbound" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Outbound list
        </Link>
        <span className="ml-auto">
          {to.length ? (
            <SendNow partnerId={id} showId={showId} kind={kind} to={to.join(", ")} />
          ) : (
            <Link href={`/ship-centers/${id}`} className="text-dts-maroon hover:underline">
              Set where the manifest goes first →
            </Link>
          )}
        </span>
      </div>
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
          Subject: <span className="font-medium text-slate-700">{m.subject}</span>
        </div>
        <iframe title="The email" srcDoc={m.html} sandbox="" className="h-[640px] w-full bg-slate-50" />
      </Card>
      <Card>
        <CardHeader title="Sent" icon="clock" />
        {log?.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {log.map((l) => (
              <li key={`${l.sent_at}-${l.subject}`} className="flex flex-wrap items-center gap-2 px-5 py-2.5">
                <span className="text-slate-900">{l.subject}</span>
                <span className="text-xs text-slate-500">
                  to {l.sent_to} · {formatPacificDateTime(l.sent_at)} · {l.sent_by ? "sent by hand" : "on schedule"}
                </span>
                {l.ok === false ? <span className="text-xs text-dts-maroon">Failed: {l.error}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-slate-400">Nothing sent yet.</p>
        )}
      </Card>
    </div>
  );
}
