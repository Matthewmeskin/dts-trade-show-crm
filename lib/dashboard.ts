import { createClient } from "@/lib/supabase/server";
import { today, daysUntil } from "@/lib/format";
import { MOVE_OUT_COUNTER_EPOCH } from "@/lib/forced";
import { loadSuccessfulMoveOuts } from "@/lib/move-outs";
import {
  pickFeaturedShow,
  sortUpcoming,
  nextCriticalDeadline,
  type ShowWithStatus,
  type Deadline,
} from "@/lib/shows";
import {
  rollupShipmentStatus,
  effectiveDirection,
  effectiveTargetDate,
  deliveryHealth,
  DELIVERY_HEALTH_META,
  type RollupColor,
  type ShipmentStatus,
  type DeliveryHealth,
} from "@/lib/shipments";

/** Local YYYY-MM-DD for `today` (avoids UTC drift from toISOString). */
function todayISO(): string {
  const d = today();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type FeaturedShow = ShowWithStatus & {
  venueName: string | null;
  venueCity: string | null;
  venueState: string | null;
  deadline: Deadline | null;
};

export type ExhibitorStatusRow = {
  id: string;
  companyName: string;
  industry: string | null;
  shipmentCount: number;
  color: RollupColor;
};

export type ShipmentSummary = {
  total: number;
  booked: number;
  in_transit: number;
  delivered: number;
  issue: number;
};

export type AttentionShipment = {
  id: string;
  status: ShipmentStatus;
  pickup_date: string | null;
  pro_number: string | null;
  exhibitor: string | null;
  show: string | null;
  days: number | null;
};

export type CutoffAlert = {
  showId: string;
  showName: string;
  date: string;
  days: number;
};

export type DeliveryRiskAlert = {
  id: string;
  exhibitor: string | null;
  show: string | null;
  health: DeliveryHealth;
  target: string | null;
  days: number | null;
};

export type OpenTask = {
  id: string;
  title: string;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "completed";
  assignee: string | null;
  days: number | null;
};

export type UpcomingShow = ShowWithStatus & {
  venueName: string | null;
  cutoffDays: number | null;
};

export type WeekEvent = {
  id: string;
  exhibitor: string | null;
  status: ShipmentStatus;
  direction: "move_in" | "move_out" | null;
  show: string | null;
  carrier: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  checkIn: string | null;
};

export type WeekDay = {
  date: string; // YYYY-MM-DD
  weekday: string; // Sun, Mon, …
  dayNum: number;
  isToday: boolean;
  events: WeekEvent[];
};

export type DashboardData = {
  featured: FeaturedShow | null;
  exhibitorStatuses: ExhibitorStatusRow[];
  shipmentSummary: ShipmentSummary;
  weekDays: WeekDay[];
  alerts: {
    cutoffs: CutoffAlert[];
    deliveryRisks: DeliveryRiskAlert[];
    quotedNearPickup: AttentionShipment[];
    issues: AttentionShipment[];
    total: number;
  };
  openTasks: OpenTask[];
  upcomingShows: UpcomingShow[];
  moveOutStreak: MoveOutStreak;
};

export type MoveOutStreak = {
  /** Successful (non-forced, delivered) move-outs since the reset point. */
  successful: number;
  /** The date counting resumes from: the last forced event, or the epoch. */
  since: string;
  /** The day the counter began tallying (feature launch). */
  startsOn: string;
  /** False until the epoch is reached ("starts tomorrow"). */
  active: boolean;
  lastForcedAt: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local YYYY-MM-DD for a Date (avoids UTC drift). */
function localISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type WeekBasis = "pickup" | "delivery";

export async function loadDashboard(weekBasis: WeekBasis = "pickup"): Promise<DashboardData> {
  const supabase = await createClient();
  const iso = todayISO();

  // Current week, Sunday → Saturday, for the dashboard week strip.
  const base = today();
  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - base.getDay());
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(localISO(d));
  }

  const [showsRes, venuesRes, attentionRes, deliveryRes, allShipRes, tasksRes, weekRes] = await Promise.all([
    supabase.from("shows_with_status").select("*"),
    supabase.from("venues").select("id, venue_name, city, state"),
    supabase
      .from("shipments")
      .select(
        "id, status, pickup_date, pro_number, exhibitor:exhibitors(company_name), show:shows(show_name)",
      )
      .in("status", ["issue", "quoted"]),
    supabase
      .from("shipments")
      .select(
        "id, status, direction, destination_type, target_delivery_date, estimated_delivery_date, actual_delivery_date, exhibitor:exhibitors(company_name), show:shows(show_name, move_in_start, move_out_start, move_out_end, advance_warehouse_cutoff)",
      )
      .neq("status", "delivered"),
    supabase.from("shipments").select("status"),
    supabase
      .from("tasks")
      .select(
        "id, title, due_date, priority, status, assignee:profiles!tasks_assigned_to_fkey(full_name)",
      )
      .neq("status", "completed")
      .not("due_date", "is", null)
      .lte("due_date", iso)
      .order("due_date", { ascending: true }),
    (() => {
      const sel = supabase
        .from("shipments")
        .select(
          "id, status, direction, check_in_number, pickup_date, estimated_delivery_date, actual_delivery_date, exhibitor:exhibitors(company_name), show:shows(show_name), carrier:carriers(carrier_name)",
        );
      const ws = weekDates[0];
      const we = weekDates[6];
      return weekBasis === "delivery"
        ? sel.or(
            `and(actual_delivery_date.gte.${ws},actual_delivery_date.lte.${we}),and(estimated_delivery_date.gte.${ws},estimated_delivery_date.lte.${we})`,
          )
        : sel.gte("pickup_date", ws).lte("pickup_date", we);
    })(),
  ]);

  // ---- Week strip (shipments by pickup or delivery date) -------------------
  const eventDate = (s: {
    pickup_date: string | null;
    estimated_delivery_date: string | null;
    actual_delivery_date: string | null;
  }): string | null =>
    weekBasis === "delivery"
      ? s.actual_delivery_date ?? s.estimated_delivery_date
      : s.pickup_date;

  const eventsByDate = new Map<string, WeekEvent[]>();
  for (const s of weekRes.data ?? []) {
    const d = eventDate(s);
    if (!d) continue;
    const key = d.slice(0, 10);
    const list = eventsByDate.get(key) ?? [];
    list.push({
      id: s.id,
      exhibitor: s.exhibitor?.company_name ?? null,
      status: s.status,
      direction: s.direction,
      show: s.show?.show_name ?? null,
      carrier: s.carrier?.carrier_name ?? null,
      pickupDate: s.pickup_date,
      deliveryDate: s.actual_delivery_date ?? s.estimated_delivery_date,
      checkIn: s.check_in_number,
    });
    eventsByDate.set(key, list);
  }
  const weekDays: WeekDay[] = weekDates.map((d, i) => ({
    date: d,
    weekday: WEEKDAYS[i],
    dayNum: Number(d.slice(8, 10)),
    isToday: d === iso,
    events: eventsByDate.get(d) ?? [],
  }));

  const shows = (showsRes.data ?? []) as ShowWithStatus[];
  const venues = venuesRes.data ?? [];
  const venueById = new Map(venues.map((v) => [v.id, v]));

  // ---- Featured show -------------------------------------------------------
  const featuredBase = pickFeaturedShow(shows);
  let featured: FeaturedShow | null = null;
  let exhibitorStatuses: ExhibitorStatusRow[] = [];
  // Shipment tiles count every shipment, not just the featured show's — most
  // TMS-imported loads aren't linked to a show yet.
  const shipmentSummary: ShipmentSummary = {
    total: 0,
    booked: 0,
    in_transit: 0,
    delivered: 0,
    issue: 0,
  };
  for (const s of allShipRes.data ?? []) {
    shipmentSummary.total += 1;
    if (s.status === "booked") shipmentSummary.booked += 1;
    else if (s.status === "in_transit") shipmentSummary.in_transit += 1;
    else if (s.status === "delivered") shipmentSummary.delivered += 1;
    else if (s.status === "issue") shipmentSummary.issue += 1;
  }

  if (featuredBase?.id) {
    const venue = featuredBase.venue_id
      ? venueById.get(featuredBase.venue_id)
      : undefined;
    featured = {
      ...featuredBase,
      venueName: venue?.venue_name ?? null,
      venueCity: venue?.city ?? null,
      venueState: venue?.state ?? null,
      deadline: nextCriticalDeadline(featuredBase),
    };

    const [exhRes, shipRes] = await Promise.all([
      supabase
        .from("show_exhibitors")
        .select("exhibitor:exhibitors(id, company_name, industry)")
        .eq("show_id", featuredBase.id),
      supabase
        .from("shipments")
        .select("status, exhibitor:exhibitors(id, company_name, industry)")
        .eq("show_id", featuredBase.id),
    ]);

    // Exhibitor traffic-light rollup. Sourced from the show's SHIPMENTS (where
    // the exhibitor link actually lives), supplemented by any manual
    // show_exhibitors entries that have no freight yet.
    type ExhInfo = { id: string; company_name: string; industry: string | null };
    const exhInfo = new Map<string, ExhInfo>();
    const byExhibitor = new Map<string, ShipmentStatus[]>();
    for (const s of shipRes.data ?? []) {
      if (!s.exhibitor) continue;
      exhInfo.set(s.exhibitor.id, s.exhibitor);
      const list = byExhibitor.get(s.exhibitor.id) ?? [];
      list.push(s.status);
      byExhibitor.set(s.exhibitor.id, list);
    }
    for (const row of exhRes.data ?? []) {
      if (row.exhibitor && !exhInfo.has(row.exhibitor.id)) exhInfo.set(row.exhibitor.id, row.exhibitor);
    }

    exhibitorStatuses = [...exhInfo.values()]
      .map((e) => {
        const statuses = byExhibitor.get(e.id) ?? [];
        return {
          id: e.id,
          companyName: e.company_name,
          industry: e.industry,
          shipmentCount: statuses.length,
          color: rollupShipmentStatus(statuses),
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }

  // ---- Alerts --------------------------------------------------------------
  const cutoffs: CutoffAlert[] = shows
    .filter(
      (s) =>
        (s.status === "active" || s.status === "upcoming") &&
        s.advance_warehouse_cutoff != null &&
        s.id != null,
    )
    .map((s) => ({
      showId: s.id!,
      showName: s.show_name ?? "Untitled show",
      date: s.advance_warehouse_cutoff!,
      days: daysUntil(s.advance_warehouse_cutoff)!,
    }))
    .filter((c) => c.days >= 0 && c.days <= 2)
    .sort((a, b) => a.days - b.days);

  const attention = (attentionRes.data ?? []).map((s) => ({
    id: s.id,
    status: s.status,
    pickup_date: s.pickup_date,
    pro_number: s.pro_number,
    exhibitor: s.exhibitor?.company_name ?? null,
    show: s.show?.show_name ?? null,
    days: daysUntil(s.pickup_date),
  }));

  const issues = attention.filter((s) => s.status === "issue");
  const quotedNearPickup = attention
    .filter(
      (s) => s.status === "quoted" && s.days != null && s.days <= 3,
    )
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  // Move-in deliveries at risk of missing their target — on-time delivery
  // matters most for getting freight to the show.
  const deliveryRisks: DeliveryRiskAlert[] = (deliveryRes.data ?? [])
    .filter((s) => effectiveDirection(s) === "move_in")
    .map((s) => {
      const target = effectiveTargetDate(s, s.show);
      return {
        id: s.id,
        exhibitor: s.exhibitor?.company_name ?? null,
        show: s.show?.show_name ?? null,
        health: deliveryHealth({
          status: s.status,
          estimatedDelivery: s.estimated_delivery_date,
          actualDelivery: s.actual_delivery_date,
          target,
        }),
        target,
        days: daysUntil(target),
      };
    })
    .filter((r) => r.health === "overdue" || r.health === "at_risk" || r.health === "due_soon")
    .sort(
      (a, b) =>
        DELIVERY_HEALTH_META[b.health].rank - DELIVERY_HEALTH_META[a.health].rank ||
        (a.target ?? "9999-12-31").localeCompare(b.target ?? "9999-12-31"),
    )
    .slice(0, 8);

  // ---- Open tasks (due today or overdue) -----------------------------------
  const openTasks: OpenTask[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    priority: t.priority,
    status: t.status,
    assignee: t.assignee?.full_name ?? null,
    days: daysUntil(t.due_date),
  }));

  // ---- Upcoming shows strip (next 3) ---------------------------------------
  const upcomingShows: UpcomingShow[] = sortUpcoming(shows)
    .slice(0, 3)
    .map((s) => ({
      ...s,
      venueName: s.venue_id ? venueById.get(s.venue_id)?.venue_name ?? null : null,
      cutoffDays: daysUntil(s.advance_warehouse_cutoff),
    }));

  // ---- Successful move-out streak (restarts whenever a load is forced) ----
  // Shares the exact query behind the /move-outs list, so the counter and the
  // drill-down list can never disagree.
  const { rows: successfulMoveOuts, resetDate, lastForcedAt } =
    await loadSuccessfulMoveOuts(supabase);

  const moveOutStreak: MoveOutStreak = {
    successful: successfulMoveOuts.length,
    since: resetDate,
    startsOn: MOVE_OUT_COUNTER_EPOCH,
    active: iso >= MOVE_OUT_COUNTER_EPOCH,
    lastForcedAt,
  };

  return {
    featured,
    exhibitorStatuses,
    shipmentSummary,
    weekDays,
    alerts: {
      cutoffs,
      deliveryRisks,
      quotedNearPickup,
      issues,
      total: cutoffs.length + deliveryRisks.length + quotedNearPickup.length + issues.length,
    },
    openTasks,
    upcomingShows,
    moveOutStreak,
  };
}
