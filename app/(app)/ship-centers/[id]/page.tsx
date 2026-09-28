import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatDateRange, todayYMD } from "@/lib/format";
import { effectiveStatus } from "@/lib/logistics";
import { gscMatches, gscNameFor, shipPath, shipShowStatus } from "@/lib/ship-center";
import { setShipShowEnabled } from "../actions";
import { AddShowPanel, DetailsForm } from "../panels";
import { blobConfigured } from "@/lib/logo-upload";

export const dynamic = "force-dynamic";

export default async function ShipCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayYMD();

  const { data: gsc } = await supabase
    .from("partners")
    .select("id, name, public_name, code, partner_type, ship_phone, ship_email, logo_url")
    .eq("id", id)
    .maybeSingle();
  if (!gsc) notFound();

  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: me }, { data: rows }, { data: upcoming }, { data: venues }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", claims?.claims?.sub ?? "").maybeSingle(),
    supabase
      .from("ship_shows")
      .select("show_id, enabled, shows(show_name, edition_year, show_start_date, show_end_date, series_id)")
      .eq("partner_id", id),
    supabase
      .from("shows")
      .select("id, show_name, show_start_date, decorator")
      .eq("archived", false)
      .gte("show_start_date", today)
      .order("show_start_date")
      .limit(500),
    supabase.from("venues").select("id, venue_name, city, state").order("venue_name").limit(1000),
  ]);
  const isAdmin = me?.role === "admin";
  const name = gscNameFor(gsc);

  if (gsc.partner_type !== "gsc") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={name} breadcrumbs={[{ label: "GSC Shipping Centers", href: "/ship-centers" }]} />
        <Card className="p-6 text-sm text-slate-600">
          Shipping Centers are for GSCs. This partner is not set up as a GSC. Change its type on the{" "}
          <Link href={`/partners/${id}/edit`} className="text-dts-blue hover:underline">partner record</Link> if that is wrong.
        </Card>
      </div>
    );
  }

  const showIds = (rows ?? []).map((r) => r.show_id);
  const { data: logistics } = showIds.length
    ? await supabase.from("show_public_logistics").select("show_id, verification_status, last_verified_at").in("show_id", showIds)
    : { data: [] as { show_id: string; verification_status: string; last_verified_at: string | null }[] };
  const logBy = new Map((logistics ?? []).map((l) => [l.show_id, l]));
  const seriesIds = [...new Set((rows ?? []).map((r) => r.shows?.series_id).filter((x): x is string => !!x))];
  const { data: series } = seriesIds.length
    ? await supabase.from("show_series").select("id, slug").in("id", seriesIds)
    : { data: [] as { id: string; slug: string }[] };
  const slugBy = new Map((series ?? []).map((x) => [x.id, x.slug]));

  const shows = (rows ?? [])
    .filter((r) => r.shows)
    .map((r) => ({
      ...r,
      status: shipShowStatus(r.enabled, effectiveStatus(logBy.get(r.show_id) ?? null, r.shows!.show_end_date), r.shows!.show_end_date, today),
    }))
    .sort((a, b) => {
      const past = Number(a.status.state === "past") - Number(b.status.state === "past");
      return past || (a.shows!.show_start_date ?? "9999").localeCompare(b.shows!.show_start_date ?? "9999");
    });

  const inList = new Set(showIds);
  const choices = (upcoming ?? [])
    .filter((s) => !inList.has(s.id))
    .map((s) => ({
      id: s.id,
      label: s.show_name,
      start: s.show_start_date,
      // Shows another GSC runs are listed, but flagged, so nobody adds FABTECH by mistake.
      otherGsc: s.decorator && !gscMatches(s.decorator, gsc) ? s.decorator : null,
    }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={name}
        description="Shipping Center"
        breadcrumbs={[{ label: "GSC Shipping Centers", href: "/ship-centers" }]}
        actions={
          <Link
            href={`/partners/${id}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Partner record
          </Link>
        }
      />

      {!isAdmin ? (
        <p className="mb-4 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
          During the pilot only an admin can add shows or turn them on. You can still set up a show&apos;s details.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Shows" icon="shows" />
            {shows.length ? (
              <ul className="divide-y divide-slate-100">
                {shows.map((s) => {
                  const setupHref = `/ship-centers/${id}/shows/${s.show_id}`;
                  const slug = s.shows!.series_id ? slugBy.get(s.shows!.series_id) : null;
                  return (
                    <li key={s.show_id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <Link href={setupHref} className="font-medium text-slate-900 hover:text-dts-maroon">
                          {s.shows!.show_name}
                        </Link>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {formatDateRange(s.shows!.show_start_date, s.shows!.show_end_date)}
                          {gsc.code && slug ? (
                            <span className="ml-2 font-mono text-slate-400">{shipPath(gsc.code, slug, s.shows!.edition_year)}</span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge className={s.status.badge}>{s.status.label}</Badge>
                          <span className="text-xs text-slate-500">{s.status.detail}</span>
                        </div>
                      </div>
                      <RowAction
                        action={s.status.action}
                        isAdmin={isAdmin}
                        partnerId={id}
                        showId={s.show_id}
                        setupHref={setupHref}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon="shows" title="No shows yet" description="Add the first show this GSC runs." />
            )}
            <div className="border-t border-slate-100 p-5">
              <AddShowPanel
                partnerId={id}
                gscName={name}
                canAdd={isAdmin && !!gsc.code}
                blockedReason={!gsc.code ? "Save a kit link code first (on the right)." : !isAdmin ? "Only an admin can add shows during the pilot." : null}
                choices={choices}
                venues={(venues ?? []).map((v) => ({ id: v.id, label: [v.venue_name, [v.city, v.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") }))}
              />
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Kit link and contact" icon="external" />
            <DetailsForm
              uploadReady={blobConfigured()}
              partnerId={id}
              suggestedCode={gsc.code ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}
              hasCode={!!gsc.code}
              values={{
                code: gsc.code,
                public_name: gsc.public_name,
                ship_phone: gsc.ship_phone,
                ship_email: gsc.ship_email,
                logo_url: gsc.logo_url,
              }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

const btn = "rounded-lg px-3 py-1.5 text-sm font-medium transition";

function RowAction({
  action,
  isAdmin,
  partnerId,
  showId,
  setupHref,
}: {
  action: "turn_off" | "turn_on" | "set_up" | "reconfirm" | null;
  isAdmin: boolean;
  partnerId: string;
  showId: string;
  setupHref: string;
}) {
  if (action === "set_up" || action === "reconfirm") {
    return (
      <Link href={setupHref} className={`${btn} bg-dts-maroon text-white hover:bg-dts-maroon-dark`}>
        {action === "set_up" ? "Set up" : "Reconfirm"}
      </Link>
    );
  }
  if ((action === "turn_on" || action === "turn_off") && isAdmin) {
    return (
      <form action={setShipShowEnabled}>
        <input type="hidden" name="partner_id" value={partnerId} />
        <input type="hidden" name="show_id" value={showId} />
        <input type="hidden" name="enabled" value={action === "turn_on" ? "true" : "false"} />
        <button
          type="submit"
          className={
            action === "turn_on"
              ? `${btn} bg-emerald-700 text-white hover:bg-emerald-800`
              : `${btn} border border-slate-300 text-slate-600 hover:bg-slate-100`
          }
        >
          {action === "turn_on" ? "Turn on" : "Turn off"}
        </button>
      </form>
    );
  }
  return (
    <Link href={setupHref} className={`${btn} text-slate-500 hover:text-slate-800`}>
      Details
    </Link>
  );
}
