import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  STALE_AFTER_DAYS,
  effectiveStatus,
  goesStaleOn,
} from "@/lib/logistics";

export const dynamic = "force-dynamic";

/**
 * The publishing queue: the three lists that decide whether the show pages stay
 * true, in the order they cost something.
 *
 *   1. Going stale soon - a live page that is about to start hiding its addresses.
 *   2. Drafts waiting   - work already started that nobody has verified.
 *   3. No logistics yet  - upcoming editions the pages know nothing about.
 *
 * Deliberately not a dashboard. Every row is a link to the one screen where the
 * thing can be fixed.
 */
export default async function PublishingQueuePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: rows }, { data: bare }] = await Promise.all([
    supabase
      .from("show_public_logistics")
      .select(
        "show_id, verification_status, last_verified_at, verified_by, timezone, source_url, shows!inner(show_name, edition_year, show_start_date, show_end_date, archived, series_id)",
      )
      .order("last_verified_at", { ascending: true, nullsFirst: true }),
    // Upcoming editions with no logistics row at all. Left join, then filter for
    // the missing side.
    supabase
      .from("shows")
      .select(
        "id, show_name, edition_year, show_start_date, series_id, show_public_logistics(show_id)",
      )
      .eq("archived", false)
      .gte("show_start_date", today)
      .order("show_start_date"),
  ]);

  type Row = NonNullable<typeof rows>[number];
  const live = (rows ?? []).filter(
    (r) => r.shows && !r.shows.archived,
  );

  const withStatus = live.map((r) => ({
    row: r,
    status: effectiveStatus(r, r.shows?.show_end_date ?? null),
    staleOn: goesStaleOn(r),
  }));

  const soon = new Date();
  soon.setDate(soon.getDate() + 14);

  const goingStale = withStatus
    .filter(
      (x) =>
        x.status === "verified" &&
        x.staleOn !== null &&
        x.staleOn <= soon &&
        (x.row.shows?.show_end_date ?? "") >= today,
    )
    .sort((a, b) => (a.staleOn! < b.staleOn! ? -1 : 1));

  const alreadyStale = withStatus.filter(
    (x) => x.status === "stale" && (x.row.shows?.show_end_date ?? "") >= today,
  );

  const drafts = withStatus.filter((x) => x.status === "draft");

  const missing = (bare ?? []).filter(
    (s) =>
      !s.show_public_logistics ||
      (Array.isArray(s.show_public_logistics) && s.show_public_logistics.length === 0),
  );

  const label = (r: Row) =>
    `${r.shows?.show_name ?? "Untitled"}${r.shows?.edition_year ? ` ${r.shows.edition_year}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Publishing queue"
        description="What the public show pages need from a person, in the order it costs something."
        breadcrumbs={[{ label: "Shows", href: "/shows" }]}
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title={`Stale now — pages hiding their addresses (${alreadyStale.length})`}
            icon="alert"
          />
          {alreadyStale.length ? (
            <ul className="divide-y divide-slate-100">
              {alreadyStale.map((x) => (
                <li key={x.row.show_id}>
                  <Link
                    href={`/shows/${x.row.show_id}?tab=logistics`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {label(x.row)}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      {x.row.last_verified_at ? (
                        <span>
                          verified {formatDate(x.row.last_verified_at.slice(0, 10))}
                          {x.row.verified_by ? ` by ${x.row.verified_by}` : ""}
                        </span>
                      ) : (
                        <span>never verified</span>
                      )}
                      <Badge className="bg-orange-100 text-orange-800">Stale</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="check"
              title="Nothing stale"
              description="Every live page for an upcoming show was checked within the last 60 days."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title={`Going stale in the next 14 days (${goingStale.length})`}
            icon="clock"
          />
          {goingStale.length ? (
            <ul className="divide-y divide-slate-100">
              {goingStale.map((x) => (
                <li key={x.row.show_id}>
                  <Link
                    href={`/shows/${x.row.show_id}?tab=logistics`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {label(x.row)}
                    </span>
                    <span className="text-xs text-slate-500">
                      goes stale {formatDate(x.staleOn!.toISOString().slice(0, 10))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="check"
              title="Nothing due"
              description={`Re-verifying happens every ${STALE_AFTER_DAYS} days. Nothing falls due in the next fortnight.`}
            />
          )}
        </Card>

        <Card>
          <CardHeader title={`Drafts waiting for review (${drafts.length})`} icon="documents" />
          {drafts.length ? (
            <ul className="divide-y divide-slate-100">
              {drafts.map((x) => (
                <li key={x.row.show_id}>
                  <Link
                    href={`/shows/${x.row.show_id}?tab=logistics`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {label(x.row)}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      {x.row.source_url ? "has a source" : "no source yet"}
                      {!x.row.timezone ? " · no timezone" : ""}
                      {!x.row.shows?.series_id ? " · not attached to a show" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="check"
              title="No drafts"
              description="Nothing is half-finished."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title={`Upcoming editions with no logistics yet (${missing.length})`}
            icon="calendar"
          />
          {missing.length ? (
            <ul className="divide-y divide-slate-100">
              {missing.slice(0, 40).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/shows/${s.id}?tab=logistics`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {s.show_name}
                      {s.edition_year ? (
                        <span className="ml-1.5 font-normal text-slate-400">
                          {s.edition_year}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      {s.show_start_date ? formatDate(s.show_start_date) : "no dates"}
                      {!s.series_id ? (
                        <Badge className="bg-slate-100 text-slate-600">
                          not attached
                        </Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="check"
              title="Every upcoming edition has been started"
              description="Nothing coming up is unknown to the show pages."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
