import Link from "next/link";
import { loadDashboard } from "@/lib/dashboard";
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
import { ROLLUP_META, DELIVERY_HEALTH_META } from "@/lib/shipments";
import {
  formatDateRange,
  formatDate,
  formatShortDate,
  formatCountdown,
} from "@/lib/format";
import { AiSummaryCard } from "./ai-summary-card";

export const dynamic = "force-dynamic";

const PRIORITY_META: Record<string, string> = {
  high: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

export default async function DashboardPage() {
  const data = await loadDashboard();
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Featured show */}
        <div className="lg:col-span-2">
          <FeaturedShowCard data={data} />
        </div>

        {/* AI summary (placeholder until Anthropic integration) */}
        <AiSummaryCard showName={featured?.show_name ?? null} />

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
        <ul className="divide-y divide-slate-100">
          {alerts.deliveryRisks.map((d) => {
            const hm = DELIVERY_HEALTH_META[d.health];
            return (
              <li key={`delrisk-${d.id}`} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${d.health === "due_soon" ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
                  <Icon name="truck" className="h-3.5 w-3.5" />
                </span>
                <div className="text-sm">
                  <Link href={`/shipments/${d.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                    {d.exhibitor ?? "Shipment"}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    move-in delivery {hm.label.toLowerCase()}
                    {d.show ? ` · ${d.show}` : ""}
                    {d.days != null ? ` · due ${formatCountdown(d.days)}` : ""}
                  </span>
                </div>
              </li>
            );
          })}
          {alerts.cutoffs.map((c) => (
            <li key={`cutoff-${c.showId}`} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Icon name="clock" className="h-3.5 w-3.5" />
              </span>
              <div className="text-sm">
                <span className="font-medium text-slate-900">{c.showName}</span>
                <span className="text-slate-500">
                  {" "}
                  advance warehouse cutoff {formatCountdown(c.days)}
                </span>
              </div>
            </li>
          ))}
          {alerts.issues.map((s) => (
            <li key={`issue-${s.id}`} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Icon name="alert" className="h-3.5 w-3.5" />
              </span>
              <div className="text-sm">
                <span className="font-medium text-slate-900">
                  {s.exhibitor ?? "Shipment"}
                </span>
                <span className="text-slate-500">
                  {" "}
                  flagged as an issue{s.show ? ` · ${s.show}` : ""}
                </span>
              </div>
            </li>
          ))}
          {alerts.quotedNearPickup.map((s) => (
            <li key={`quoted-${s.id}`} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <Icon name="truck" className="h-3.5 w-3.5" />
              </span>
              <div className="text-sm">
                <span className="font-medium text-slate-900">
                  {s.exhibitor ?? "Shipment"}
                </span>
                <span className="text-slate-500">
                  {" "}
                  still quoted, pickup {formatCountdown(s.days)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
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
