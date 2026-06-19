import { createClient } from "@/lib/supabase/server";
import { today, daysUntil } from "@/lib/format";
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

export type DashboardData = {
  featured: FeaturedShow | null;
  exhibitorStatuses: ExhibitorStatusRow[];
  shipmentSummary: ShipmentSummary;
  alerts: {
    cutoffs: CutoffAlert[];
    deliveryRisks: DeliveryRiskAlert[];
    quotedNearPickup: AttentionShipment[];
    issues: AttentionShipment[];
    total: number;
  };
  openTasks: OpenTask[];
  upcomingShows: UpcomingShow[];
};

export async function loadDashboard(): Promise<DashboardData> {
  const supabase = await createClient();
  const iso = todayISO();

  const [showsRes, venuesRes, attentionRes, deliveryRes, tasksRes] = await Promise.all([
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
    supabase
      .from("tasks")
      .select(
        "id, title, due_date, priority, status, assignee:profiles!tasks_assigned_to_fkey(full_name)",
      )
      .neq("status", "completed")
      .not("due_date", "is", null)
      .lte("due_date", iso)
      .order("due_date", { ascending: true }),
  ]);

  const shows = (showsRes.data ?? []) as ShowWithStatus[];
  const venues = venuesRes.data ?? [];
  const venueById = new Map(venues.map((v) => [v.id, v]));

  // ---- Featured show -------------------------------------------------------
  const featuredBase = pickFeaturedShow(shows);
  let featured: FeaturedShow | null = null;
  let exhibitorStatuses: ExhibitorStatusRow[] = [];
  const shipmentSummary: ShipmentSummary = {
    total: 0,
    booked: 0,
    in_transit: 0,
    delivered: 0,
    issue: 0,
  };

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
        .select("id, exhibitor_id, status")
        .eq("show_id", featuredBase.id),
    ]);

    const featuredShipments = shipRes.data ?? [];

    // Shipment summary tiles for the featured show.
    for (const s of featuredShipments) {
      shipmentSummary.total += 1;
      if (s.status === "booked") shipmentSummary.booked += 1;
      else if (s.status === "in_transit") shipmentSummary.in_transit += 1;
      else if (s.status === "delivered") shipmentSummary.delivered += 1;
      else if (s.status === "issue") shipmentSummary.issue += 1;
    }

    // Exhibitor traffic-light rollup.
    const byExhibitor = new Map<string, ShipmentStatus[]>();
    for (const s of featuredShipments) {
      if (!s.exhibitor_id) continue;
      const list = byExhibitor.get(s.exhibitor_id) ?? [];
      list.push(s.status);
      byExhibitor.set(s.exhibitor_id, list);
    }

    exhibitorStatuses = (exhRes.data ?? [])
      .map((row) => row.exhibitor)
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
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

  return {
    featured,
    exhibitorStatuses,
    shipmentSummary,
    alerts: {
      cutoffs,
      deliveryRisks,
      quotedNearPickup,
      issues,
      total: cutoffs.length + deliveryRisks.length + quotedNearPickup.length + issues.length,
    },
    openTasks,
    upcomingShows,
  };
}
