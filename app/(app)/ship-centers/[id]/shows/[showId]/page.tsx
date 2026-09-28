import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, PageHeader } from "@/components/ui";
import { todayYMD } from "@/lib/format";
import { effectiveStatus } from "@/lib/logistics";
import { gscNameFor, shipPath, shipShowStatus } from "@/lib/ship-center";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function ShipShowSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; showId: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  const { id, showId } = await params;
  const { added } = await searchParams;
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: gsc }, { data: show }, { data: ship }, { data: logistics }, { data: venues }, { data: me }] = await Promise.all([
    supabase.from("partners").select("id, name, public_name, code").eq("id", id).maybeSingle(),
    supabase.from("shows").select("*").eq("id", showId).maybeSingle(),
    supabase.from("ship_shows").select("enabled, coordinator_name, coordinator_mobile").eq("partner_id", id).eq("show_id", showId).maybeSingle(),
    supabase.from("show_public_logistics").select("*").eq("show_id", showId).maybeSingle(),
    supabase.from("venues").select("id, venue_name, city, state").order("venue_name").limit(1000),
    supabase.from("profiles").select("role").eq("id", claims?.claims?.sub ?? "").maybeSingle(),
  ]);
  if (!gsc || !show || !ship) notFound();

  const { data: series } = show.series_id
    ? await supabase.from("show_series").select("slug, name, is_public").eq("id", show.series_id).maybeSingle()
    : { data: null };

  const details = effectiveStatus(logistics ?? null, show.show_end_date);
  const status = shipShowStatus(ship.enabled, details, show.show_end_date, todayYMD());
  const name = gscNameFor(gsc);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={show.show_name}
        description={`Set up for ${name}'s Shipping Center`}
        breadcrumbs={[
          { label: "GSC Shipping Centers", href: "/ship-centers" },
          { label: name, href: `/ship-centers/${id}` },
        ]}
        actions={
          <Link
            href={`/shows/${showId}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Full show record
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge className={status.badge}>{status.label}</Badge>
        <span className="text-sm text-slate-500">{status.detail}</span>
      </div>

      {added ? (
        <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Added to {name}&apos;s Shipping Center. Fill in the details below (reading the exhibitor kit is the quickest
          way), then verify.
        </p>
      ) : null}

      {series?.is_public ? (
        <p className="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This show also has a public page on dtsone.com, so verifying here updates that page too.
        </p>
      ) : null}

      <SetupForm
        partnerId={id}
        showId={showId}
        isAdmin={me?.role === "admin"}
        enabled={ship.enabled}
        webAddress={series && gsc.code ? shipPath(gsc.code, series.slug, show.edition_year) : null}
        code={gsc.code}
        show={show}
        logistics={logistics ?? null}
        coordinator={{ name: ship.coordinator_name, mobile: ship.coordinator_mobile }}
        venues={(venues ?? []).map((v) => ({ id: v.id, venue_name: v.venue_name, label: [v.venue_name, [v.city, v.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") }))}
      />
    </div>
  );
}
