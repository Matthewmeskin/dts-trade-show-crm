import Link from "next/link";
import { loadDashboard, type WeekDay, type WeekBasis, type MoveOutStreak } from "@/lib/dashboard";
import {
  PageHeader,
  Card,
  CardHeader,
  EmptyState,
  Badge,
  QuickAction,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { SHOW_STATUS_META } from "@/lib/shows";
import { ROLLUP_META, DELIVERY_HEALTH_META, SHIPMENT_STATUS_META, DIRECTION_META } from "@/lib/shipments";
import { HoverPreview } from "@/components/hover-preview";
import { ShipmentSidePanel } from "@/app/(app)/shipments/shipment-side-panel";
import {
  formatDateRange,
  formatDate,
  formatShortDate,
  formatCountdown,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const PRIORITY_META: Record<string, string> = {
  high: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekBasis: WeekBasis = week === "delivery" ? "delivery" : "pickup";
  const data = await loadDashboard(weekBasis);
  const { featured } = data;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live operational view across your trade show freight."
      />

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-2.5">
        <QuickAction href="/exhibitors/new" icon="exhibitors" label="Add exhibitor" />
        <QuickAction href="/shipments/new" icon="shipments" label="Log shipment" />
        <QuickAction href="/documents/new" icon="documents" label="Upload document" />
        <QuickAction href="/tasks/new" icon="tasks" label="Add task" />
      </div>

      {/* Successful move-out streak */}
      <div className="mb-5">
        <MoveOutStreakCard streak={data.moveOutStreak} />
      </div>

      {/* This week */}
      <div className="mb-5">
        <WeekCalendarCard days={data.weekDays} basis={weekBasis} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Featured show */}
        <div className="lg:col-span-3">
          <FeaturedShowCard data={data} />
        </div>

        {/* Shipment summary tiles */}
        <div className="lg:col-span-3">
          <ShipmentTiles summary={data.shipmentSummary} />
        </div>

        {/* Exhibitor status list */}
        <div className="lg:col-span-2">
          <ExhibitorStatusCard rows={data.exhibitorStatuses} hasFeatured={!!featured} />
        </div>

        {/* Alerts */}
        <AlertsCard alerts={data.alerts} />

        {/* Open tasks */}
        <div className="lg:col-span-2">
          <OpenTasksCard tasks={data.openTasks} />
        </div>

        {/* Upcoming shows strip */}
        <UpcomingShowsCard shows={data.upcomingShows} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function WeekCalendarCard({ days, basis }: { days: WeekDay[]; basis: WeekBasis }) {
  const total = days.reduce((n, d) => n + d.events.length, 0);
  const range =
    days.length > 0
      ? `${formatShortDate(days[0].date)} – ${formatShortDate(days[days.length - 1].date)}`
      : "";
  const tab = (label: string, value: WeekBasis) => (
    <Link
      href={value === "pickup" ? "/" : `/?week=${value}`}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        basis === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <Card>
      <CardHeader
        title="This week"
        icon="calendar"
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
              {tab("Pickup", "pickup")}
              {tab("Delivery", "delivery")}
            </div>
            <Link href="/calendar?view=week" className="text-sm font-medium text-dts-blue hover:underline">
              Full calendar →
            </Link>
          </div>
        }
      />
      <div className="px-2 pb-2 text-xs text-slate-400 sm:px-4">
        <span className="px-1">
          {range}
          {total === 0 ? ` · No ${basis === "delivery" ? "deliveries" : "pickups"} scheduled` : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-2xl border-t border-slate-100 bg-slate-100 sm:grid-cols-7">
        {days.map((d) => (
          <div
            key={d.date}
            className={`min-h-[7rem] bg-white p-2 ${d.isToday ? "ring-1 ring-inset ring-dts-maroon/30" : ""}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {d.weekday}
              </span>
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                  d.isToday ? "bg-dts-maroon text-white" : "text-slate-500"
                }`}
              >
                {d.dayNum}
              </span>
            </div>
            <div className="space-y-1">
              {d.events.slice(0, 4).map((e) => {
                const sm = SHIPMENT_STATUS_META[e.status];
                return (
                  <HoverPreview
                    key={e.id}
                    className="block"
                    label={
                      <ShipmentSidePanel
                        id={e.id}
                        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sm.dot}`} />
                        <span className="min-w-0 flex-1 truncate">{e.exhibitor ?? "Shipment"}</span>
                        {e.direction === "move_out" ? (
                          e.checkIn ? (
                            <Icon name="check" className="h-3 w-3 shrink-0 text-emerald-600" aria-label={`Checked in: ${e.checkIn}`} />
                          ) : (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full border border-amber-400 bg-amber-50"
                              title="Move-out — no check-in number yet"
                            />
                          )
                        ) : null}
                      </ShipmentSidePanel>
                    }
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{e.exhibitor ?? "Shipment"}</span>
                        <Badge className={sm.badge}>{sm.label}</Badge>
                      </div>
                      <dl className="space-y-1 text-xs">
                        <WeekPreviewRow label="Show" value={e.show ?? "—"} />
                        <WeekPreviewRow label="Direction" value={e.direction ? DIRECTION_META[e.direction].label : "—"} />
                        <WeekPreviewRow label="Carrier" value={e.carrier ?? "—"} />
                        <WeekPreviewRow label="Pickup" value={formatDate(e.pickupDate)} />
                        <WeekPreviewRow label="Delivery" value={formatDate(e.deliveryDate)} />
                      </dl>
                    </div>
                  </HoverPreview>
                );
              })}
              {d.events.length > 4 ? (
                <Link
                  href="/calendar?view=week"
                  className="block px-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
                >
                  +{d.events.length - 4} more
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WeekPreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="truncate text-right text-slate-700">{value}</dd>
    </div>
  );
}

function FeaturedShowCard({ data }: { data: Awaited<ReturnType<typeof loadDashboard>> }) {
  const featured = data.featured;

  if (!featured) {
    return (
      <Card className="h-full">
        <CardHeader title="Featured show" icon="shows" />
        <EmptyState
          icon="shows"
          title="No active or upcoming shows"
          description="Create your first show to start tracking it here."
        />
        <div className="px-5 pb-5">
          <Link
            href="/shows"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:underline"
          >
            <Icon name="plus" className="h-4 w-4" /> Create a show
          </Link>
        </div>
      </Card>
    );
  }

  const meta = SHOW_STATUS_META[featured.status ?? "upcoming"];
  const location = [featured.venueCity, featured.venueState]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="h-full">
      <CardHeader
        title={featured.status === "active" ? "Active show" : "Next show"}
        icon="shows"
        action={
          <Badge className={meta.badge}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </Badge>
        }
      />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={featured.id ? `/shows/${featured.id}` : "/shows"}
              className="text-lg font-semibold text-slate-900 hover:underline"
            >
              {featured.show_name}
              {featured.edition_year ? (
                <span className="ml-1.5 text-slate-400">
                  {featured.edition_year}
                </span>
              ) : null}
            </Link>
            <div className="mt-1 space-y-0.5 text-sm text-slate-500">
              <div className="flex items-center gap-1.5">
                <Icon name="venues" className="h-3.5 w-3.5 text-slate-400" />
                {featured.venueName ?? "Venue TBD"}
                {location ? ` · ${location}` : ""}
              </div>
              <div className="flex items-center gap-1.5">
                <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
                {formatDateRange(
                  featured.show_start_date ?? featured.move_in_start,
                  featured.show_end_date ?? featured.move_out_end,
                )}
              </div>
            </div>
          </div>

          {featured.deadline ? (
            <div className="rounded-xl bg-dts-blue px-4 py-3 text-white">
              <div className="text-[11px] font-medium uppercase tracking-wide text-white/75">
                {featured.deadline.label}
              </div>
              <div className="mt-0.5 text-2xl font-semibold leading-none">
                {featured.deadline.days === 0
                  ? "Today"
                  : `${featured.deadline.days}d`}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {formatDate(featured.deadline.date)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function ShipmentTiles({
  summary,
}: {
  summary: { total: number; booked: number; in_transit: number; delivered: number; issue: number };
}) {
  const tiles = [
    { label: "Total", value: summary.total, accent: "text-slate-900" },
    { label: "Booked", value: summary.booked, accent: "text-dts-blue" },
    { label: "In transit", value: summary.in_transit, accent: "text-amber-600" },
    { label: "Delivered", value: summary.delivered, accent: "text-emerald-600" },
    { label: "Issues", value: summary.issue, accent: "text-red-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <div className="text-xs font-medium text-slate-500">{t.label}</div>
          <div className={`mt-1 text-2xl font-semibold ${t.accent}`}>{t.value}</div>
        </Card>
      ))}
    </div>
  );
}

function MoveOutStreakCard({ streak }: { streak: MoveOutStreak }) {
  const start = formatDate(streak.startsOn);
  return (
    <Link href="/move-outs" className="group block">
      <Card className="p-5 transition group-hover:border-emerald-200 group-hover:shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
              🚛
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Successful move-outs
              </div>
              {streak.active ? (
                <>
                  <div className="text-3xl font-semibold text-emerald-600">{streak.successful}</div>
                  <div className="text-xs text-slate-500">
                    since {formatDate(streak.since)} · resets when a load is forced
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-0.5 text-lg font-semibold text-slate-700">Starts {start}</div>
                  <div className="text-xs text-slate-500">
                    Counting successful move-outs begins {start}.
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            {streak.lastForcedAt ? (
              <div className="text-right">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Last forced
                </div>
                <div className="text-sm text-slate-600">
                  {formatDate(streak.lastForcedAt.slice(0, 10))}
                </div>
              </div>
            ) : null}
            <span className="text-sm font-medium text-emerald-600 opacity-0 transition group-hover:opacity-100">
              View all →
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ExhibitorStatusCard({
  rows,
  hasFeatured,
}: {
  rows: { id: string; companyName: string; industry: string | null; shipmentCount: number; color: "green" | "yellow" | "red" }[];
  hasFeatured: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader title="Exhibitor status" icon="exhibitors" />
      {!hasFeatured || rows.length === 0 ? (
        <EmptyState
          icon="exhibitors"
          title={hasFeatured ? "No exhibitors at this show yet" : "No featured show"}
          description={
            hasFeatured
              ? "Add exhibitors to the show to track their shipment status."
              : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const meta = ROLLUP_META[r.color];
            return (
              <li
                key={r.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                  <div>
                    <Link
                      href={`/exhibitors/${r.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      {r.companyName}
                    </Link>
                    {r.industry ? (
                      <div className="text-xs text-slate-400">{r.industry}</div>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${meta.text}`}>
                    {meta.label}
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.shipmentCount} shipment{r.shipmentCount === 1 ? "" : "s"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AlertsCard({
  alerts,
}: {
  alerts: Awaited<ReturnType<typeof loadDashboard>>["alerts"];
}) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Open items & alerts"
        icon="alert"
        action={
          alerts.total > 0 ? (
            <Badge className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20">
              {alerts.total}
            </Badge>
          ) : null
        }
      />
      {alerts.total === 0 ? (
        <EmptyState icon="alert" title="All clear" description="Nothing needs attention right now." />
      ) : (
        (() => {
          // Most urgent first, then cap — a dashboard card shouldn't dump
          // hundreds of rows. Flagged issues and overdue deliveries lead;
          // "still quoted" (the noisiest bucket) comes last.
          const rows = [
            ...alerts.issues.map((s) => (
              <AlertRow
                key={`issue-${s.id}`}
                href={`/shipments/${s.id}`}
                tone="red"
                icon="alert"
                title={s.exhibitor ?? "Shipment"}
                detail={`flagged as an issue${s.show ? ` · ${s.show}` : ""}`}
              />
            )),
            ...alerts.deliveryRisks.map((d) => (
              <AlertRow
                key={`delrisk-${d.id}`}
                href={`/shipments/${d.id}`}
                tone={d.health === "due_soon" ? "amber" : "red"}
                icon="truck"
                title={d.exhibitor ?? "Shipment"}
                detail={`move-in delivery ${DELIVERY_HEALTH_META[d.health].label.toLowerCase()}${d.show ? ` · ${d.show}` : ""}${d.days != null ? ` · due ${formatCountdown(d.days)}` : ""}`}
              />
            )),
            ...alerts.cutoffs.map((c) => (
              <AlertRow
                key={`cutoff-${c.showId}`}
                tone="amber"
                icon="clock"
                title={c.showName}
                detail={`advance warehouse cutoff ${formatCountdown(c.days)}`}
              />
            )),
            ...alerts.quotedNearPickup.map((s) => (
              <AlertRow
                key={`quoted-${s.id}`}
                href={`/shipments/${s.id}`}
                tone="slate"
                icon="truck"
                title={s.exhibitor ?? "Shipment"}
                detail={`still quoted, pickup ${formatCountdown(s.days)}`}
              />
            )),
          ];
          const MAX = 6;
          const shown = rows.slice(0, MAX);
          const remaining = rows.length - shown.length;
          return (
            <>
              <ul className="divide-y divide-slate-100">{shown}</ul>
              {remaining > 0 ? (
                <Link
                  href="/shipments"
                  className="block border-t border-slate-100 px-5 py-3 text-sm font-medium text-dts-maroon hover:bg-slate-50"
                >
                  + {remaining} more open {remaining === 1 ? "item" : "items"}
                </Link>
              ) : null}
            </>
          );
        })()
      )}
    </Card>
  );
}

const ALERT_TONE: Record<string, string> = {
  red: "bg-red-100 text-red-600",
  amber: "bg-amber-100 text-amber-600",
  slate: "bg-slate-200 text-slate-600",
};

function AlertRow({
  href,
  tone,
  icon,
  title,
  detail,
}: {
  href?: string;
  tone: "red" | "amber" | "slate";
  icon: "alert" | "truck" | "clock";
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ALERT_TONE[tone]}`}>
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 text-sm">
        {href ? (
          <Link href={href} className="font-medium text-slate-900 hover:text-dts-maroon">
            {title}
          </Link>
        ) : (
          <span className="font-medium text-slate-900">{title}</span>
        )}
        <span className="text-slate-500"> {detail}</span>
      </div>
    </li>
  );
}

function OpenTasksCard({
  tasks,
}: {
  tasks: Awaited<ReturnType<typeof loadDashboard>>["openTasks"];
}) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Open tasks"
        icon="tasks"
        action={
          <Link href="/tasks" className="text-xs font-medium text-slate-500 hover:text-slate-900">
            View all
          </Link>
        }
      />
      {tasks.length === 0 ? (
        <EmptyState icon="tasks" title="Nothing due" description="No tasks are due today or overdue." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => {
            const overdue = t.days != null && t.days < 0;
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:text-dts-maroon"
                  >
                    {t.title}
                  </Link>
                  <div className="text-xs text-slate-400">
                    {t.assignee ? `${t.assignee} · ` : ""}
                    <span className={overdue ? "text-red-600" : ""}>
                      due {formatCountdown(t.days)}
                    </span>
                  </div>
                </div>
                <Badge className={PRIORITY_META[t.priority]}>{t.priority}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function UpcomingShowsCard({
  shows,
}: {
  shows: Awaited<ReturnType<typeof loadDashboard>>["upcomingShows"];
}) {
  return (
    <Card className="h-full">
      <CardHeader title="Upcoming shows" icon="calendar" />
      {shows.length === 0 ? (
        <EmptyState icon="calendar" title="No upcoming shows" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {shows.map((s) => (
            <li key={s.id} className="px-5 py-3">
              <Link
                href={s.id ? `/shows/${s.id}` : "/shows"}
                className="text-sm font-medium text-slate-900 hover:underline"
              >
                {s.show_name}
              </Link>
              <div className="mt-0.5 text-xs text-slate-400">
                {s.venueName ?? "Venue TBD"} · {formatShortDate(s.move_in_start)}
              </div>
              {s.cutoffDays != null ? (
                <div className="mt-1 text-xs text-amber-600">
                  Advance cutoff {formatCountdown(s.cutoffDays)}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
