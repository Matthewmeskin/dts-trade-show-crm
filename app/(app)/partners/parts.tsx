import Link from "next/link";
import { Badge } from "@/components/ui";
import { shiftDays } from "@/lib/sales";
import { todayYMD } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import {
  STAGES,
  TIERS,
  WEEKLY_TARGETS,
  metaOf,
  weekStart,
  weeklyNumbers,
  type WeeklyNumbers,
} from "@/lib/partners";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const TABS = [
  { key: "list", label: "Partners", href: "/partners" },
  { key: "worklist", label: "Worklist", href: "/partners/worklist" },
  { key: "playbook", label: "Playbook", href: "/partners/playbook" },
  { key: "import", label: "Import", href: "/partners/import" },
] as const;

/** The worklist is partner growth tooling: shown only when an admin has it on (lib/app-settings.ts). */
export function PartnersNav({ active, tools = false }: { active: (typeof TABS)[number]["key"]; tools?: boolean }) {
  return (
    <nav className="mb-5 flex gap-1 border-b border-slate-200">
      {TABS.filter((t) => tools || t.key !== "worklist").map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            active === t.key
              ? "border-dts-maroon text-dts-maroon"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function TierBadge({ tier }: { tier: number | null }) {
  const m = metaOf(TIERS, tier);
  return m ? <Badge className={m.badge}>{m.label}</Badge> : <span className="text-xs text-slate-400">Untiered</span>;
}

export function StageBadge({ stage }: { stage: string }) {
  const m = metaOf(STAGES, stage);
  return <Badge className={m?.badge ?? "bg-slate-100 text-slate-600"}>{m?.label ?? stage}</Badge>;
}

/** Touches and calls around this week, enough for the weekly numbers. */
export async function loadWeeklyNumbers(supabase: Supabase): Promise<WeeklyNumbers> {
  const today = todayYMD();
  // A day early, because the Pacific week starts at 7-8am UTC on Monday.
  const since = `${shiftDays(weekStart(today), -1)}T00:00:00Z`;
  const [{ data: touches }, { data: calls }] = await Promise.all([
    supabase.from("partner_touches").select("partner_id, reached, occurred_at").gte("occurred_at", since).limit(5000),
    supabase
      .from("partner_calls")
      .select("created_at, scheduled_at, status, outcome")
      .or(`created_at.gte.${since},scheduled_at.gte.${since},status.eq.booked,and(status.eq.held,outcome.is.null)`)
      .limit(5000),
  ]);
  return weeklyNumbers(touches ?? [], calls ?? [], today);
}

function Tile({
  label,
  value,
  target,
  tone,
  hint,
}: {
  label: string;
  value: string;
  target?: string;
  tone: "good" | "short" | "bad" | "neutral";
  hint?: string;
}) {
  const color =
    tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-dts-maroon" : tone === "short" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3" title={hint}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {target ? <div className="text-xs text-slate-400">{target}</div> : null}
    </div>
  );
}

/** This week against the plan's starting targets. Held calls is the admin's number. */
export function WeeklyStrip({ n }: { n: WeeklyNumbers }) {
  const band = (v: number, [lo]: readonly [number, number]) => (v >= lo ? "good" : v > 0 ? "short" : "neutral");
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="Qualified calls held" value={String(n.held)} tone={n.held ? "good" : "neutral"} target="The admin's number" />
      <Tile label="Partners worked" value={String(n.worked)} tone={band(n.worked, WEEKLY_TARGETS.worked)} target="Target 60–80" />
      <Tile label="Conversations" value={String(n.conversations)} tone={band(n.conversations, WEEKLY_TARGETS.conversations)} target="Target 10–15" />
      <Tile label="Qualified calls booked" value={String(n.booked)} tone={band(n.booked, WEEKLY_TARGETS.booked)} target="Target 3–5" />
      <Tile
        label="Show rate"
        value={n.showRate == null ? "—" : `${Math.round(n.showRate * 100)}%`}
        tone={n.showRate == null ? "neutral" : n.showRate >= WEEKLY_TARGETS.showRate ? "good" : "bad"}
        target="Target 75%+"
      />
      <Tile
        label="Rep outcomes overdue"
        value={String(n.overdueOutcomes)}
        tone={n.overdueOutcomes ? "bad" : "good"}
        target="Due within 24 hours"
        hint="Calls whose rep hasn't recorded good fit / next step / not a fit within 24 hours"
      />
    </div>
  );
}

/** Everyone with CRM access, for owner / rep pickers. */
export async function loadPeople(supabase: Supabase) {
  const { data } = await supabase.from("profiles").select("id, full_name, email, booking_url").order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email || "—", bookingUrl: p.booking_url }));
}
