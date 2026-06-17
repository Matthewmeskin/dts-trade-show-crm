import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { SHOW_STATUS_META, type ShowWithStatus, type ShowStatus } from "@/lib/shows";
import { parseDate, today as todayDate, formatDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

const PX_PER_DAY = 9;
const ROW_H = 36;
const DAY_MS = 86_400_000;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Positioned = {
  show: ShowWithStatus;
  start: Date;
  end: Date;
  lane: number;
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shows_with_status")
    .select("id, show_name, edition_year, status, advance_warehouse_open, move_in_start, move_in_end, move_out_end");

  const shows = (data ?? []) as ShowWithStatus[];

  // A show's bar spans advance-warehouse-open (or move-in) through move-out.
  const dated: { show: ShowWithStatus; start: Date; end: Date }[] = [];
  let undated = 0;
  for (const s of shows) {
    const start = parseDate(s.advance_warehouse_open) ?? parseDate(s.move_in_start);
    const end = parseDate(s.move_out_end) ?? parseDate(s.move_in_end) ?? start;
    if (start && end) dated.push({ show: s, start, end: end < start ? start : end });
    else undated += 1;
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Every show on a timeline — advance warehouse through move-out."
        actions={<Legend />}
      />

      {dated.length === 0 ? (
        <Card>
          <EmptyState
            icon="calendar"
            title="No dated shows yet"
            description={
              undated > 0
                ? `${undated} show${undated === 1 ? "" : "s"} have no dates set.`
                : "Create a show with dates to see it here."
            }
          />
        </Card>
      ) : (
        <Timeline dated={dated} undated={undated} />
      )}
    </div>
  );
}

function Timeline({
  dated,
  undated,
}: {
  dated: { show: ShowWithStatus; start: Date; end: Date }[];
  undated: number;
}) {
  // Range = whole months covering the earliest start → latest end.
  const minStart = new Date(Math.min(...dated.map((d) => d.start.getTime())));
  const maxEnd = new Date(Math.max(...dated.map((d) => d.end.getTime())));
  const rangeStart = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
  const rangeEnd = new Date(maxEnd.getFullYear(), maxEnd.getMonth() + 1, 0);

  const dayIndex = (d: Date) => Math.round((d.getTime() - rangeStart.getTime()) / DAY_MS);
  const totalDays = dayIndex(rangeEnd) + 1;
  const width = totalDays * PX_PER_DAY;

  // Greedy lane packing — sort by start, drop each show into the first lane
  // whose last bar has ended; overlapping shows fall to new lanes.
  const sorted = [...dated].sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEnds: number[] = [];
  const positioned: Positioned[] = sorted.map(({ show, start, end }) => {
    const startIdx = dayIndex(start);
    let lane = laneEnds.findIndex((endIdx) => endIdx < startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(dayIndex(end));
    } else {
      laneEnds[lane] = dayIndex(end);
    }
    return { show, start, end, lane };
  });
  const laneCount = laneEnds.length;

  // Month header segments.
  const months: { left: number; width: number; label: string }[] = [];
  for (let m = new Date(rangeStart); m <= rangeEnd; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    months.push({
      left: dayIndex(m) * PX_PER_DAY,
      width: daysInMonth * PX_PER_DAY,
      label: `${MONTHS[m.getMonth()]} ${m.getFullYear()}`,
    });
  }

  const today = todayDate();
  const todayLeft =
    today >= rangeStart && today <= rangeEnd ? dayIndex(today) * PX_PER_DAY : null;

  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <div style={{ width }} className="relative">
          {/* Month header */}
          <div className="relative mb-1 h-7">
            {months.map((m) => (
              <div
                key={m.label}
                style={{ left: m.left, width: m.width }}
                className="absolute top-0 border-l border-slate-200 pl-2 text-xs font-medium text-slate-500"
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Lanes */}
          <div className="relative" style={{ height: laneCount * ROW_H + 6 }}>
            {/* Month gridlines */}
            {months.map((m) => (
              <div
                key={`grid-${m.label}`}
                style={{ left: m.left }}
                className="absolute top-0 bottom-0 border-l border-slate-100"
              />
            ))}
            {/* Today marker */}
            {todayLeft != null ? (
              <div style={{ left: todayLeft }} className="absolute top-0 bottom-0 z-10 w-px bg-dts-maroon">
                <span className="absolute -top-0 left-1 text-[10px] font-semibold text-dts-maroon">
                  Today
                </span>
              </div>
            ) : null}

            {/* Bars */}
            {positioned.map(({ show, start, end, lane }) => {
              const left = dayIndex(start) * PX_PER_DAY;
              const barWidth = Math.max((dayIndex(end) - dayIndex(start) + 1) * PX_PER_DAY, 10);
              const meta = SHOW_STATUS_META[(show.status ?? "upcoming") as ShowStatus];
              const range = formatDateRange(
                show.advance_warehouse_open ?? show.move_in_start,
                show.move_out_end ?? show.move_in_end ?? show.move_in_start,
              );
              return (
                <Link
                  key={show.id}
                  href={`/shows/${show.id}`}
                  title={`${show.show_name} · ${range}`}
                  style={{ left, width: barWidth, top: lane * ROW_H + 4 }}
                  className={`absolute flex h-7 items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90 ${meta.bar}`}
                >
                  <span className="truncate">{show.show_name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {undated > 0 ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
          {undated} show{undated === 1 ? "" : "s"} not shown — no dates set.
        </p>
      ) : null}
    </Card>
  );
}

function Legend() {
  const items: ShowStatus[] = ["upcoming", "active", "completed", "archived"];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((s) => {
        const meta = SHOW_STATUS_META[s];
        return (
          <span key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-sm ${meta.bar}`} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
