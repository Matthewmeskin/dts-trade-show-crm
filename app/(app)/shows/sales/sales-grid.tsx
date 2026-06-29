"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { updateShowSales } from "../actions";

export type SalesGridRow = {
  id: string;
  showName: string;
  editionYear: number | null;
  showDates: string;
  startCall: string;
  emailTeam: string;
  weekBefore: string;
  past: boolean;
  exhibitor_count: number | null;
  industry_vertical: string | null;
  decorator: string | null;
  advance_warehouse_window: string | null;
  direct_to_show_window: string | null;
  sales_people: string | null;
  lead_gen_owner: string | null;
  lead_gen_start_date: string | null;
  lead_gen_completion_date: string | null;
  move_in_schedule_url: string | null;
  emailed_two_weeks: boolean;
  instantly_created: boolean;
};

const COLS =
  "minmax(170px,1.4fr) 118px 56px 110px 110px 112px 112px 80px 96px 80px 120px 110px 126px 126px 50px 150px 64px";

const inp = "w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-dts-maroon";
const head = "px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-dts-maroon px-2 py-1 text-xs font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60">
      {pending ? "…" : "Save"}
    </button>
  );
}

export function SalesGrid({ rows }: { rows: SalesGridRow[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1500px] items-center gap-x-2" style={{ gridTemplateColumns: COLS }}>
        {/* Header */}
        <div className={head}>Show</div>
        <div className={head}>Show dates</div>
        <div className={head}># Exh</div>
        <div className={head}>Industry</div>
        <div className={head}>Decorator</div>
        <div className={head}>Adv whse</div>
        <div className={head}>Direct</div>
        <div className={head}>Start call</div>
        <div className={head}>Email team</div>
        <div className={head}>Wk before</div>
        <div className={head}>Sales people</div>
        <div className={head}>Lead gen</div>
        <div className={head}>LG start</div>
        <div className={head}>LG done</div>
        <div className={head}>Inst</div>
        <div className={head}>Move-in</div>
        <div className={head} />

        {rows.map((r) => (
          <form key={r.id} action={updateShowSales} className={`contents ${r.past ? "opacity-60" : ""}`}>
            <input type="hidden" name="id" value={r.id} />

            <div className="border-t border-slate-100 py-1.5">
              <Link href={`/shows/${r.id}`} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                {r.showName}{r.editionYear ? <span className="ml-1 text-slate-400">{r.editionYear}</span> : null}
              </Link>
            </div>
            <div className="border-t border-slate-100 py-1.5 text-xs text-slate-600">{r.showDates}</div>
            <div className="border-t border-slate-100 py-1.5"><input name="exhibitor_count" type="number" defaultValue={r.exhibitor_count ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5"><input name="industry_vertical" defaultValue={r.industry_vertical ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5"><input name="decorator" defaultValue={r.decorator ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5"><input name="advance_warehouse_window" defaultValue={r.advance_warehouse_window ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5"><input name="direct_to_show_window" defaultValue={r.direct_to_show_window ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5 text-xs text-slate-500">{r.startCall}</div>
            <div className="border-t border-slate-100 py-1.5">
              <div className="text-xs text-slate-500">{r.emailTeam}</div>
              <label className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                <input type="checkbox" name="emailed_two_weeks" defaultChecked={r.emailed_two_weeks} className="h-3 w-3 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
                sent
              </label>
            </div>
            <div className="border-t border-slate-100 py-1.5 text-xs text-slate-500">{r.weekBefore}</div>
            <div className="border-t border-slate-100 py-1.5"><input name="sales_people" defaultValue={r.sales_people ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5"><input name="lead_gen_owner" defaultValue={r.lead_gen_owner ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5"><input name="lead_gen_start_date" type="date" defaultValue={r.lead_gen_start_date ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5"><input name="lead_gen_completion_date" type="date" defaultValue={r.lead_gen_completion_date ?? ""} className={inp} /></div>
            <div className="border-t border-slate-100 py-1.5">
              <input type="checkbox" name="instantly_created" defaultChecked={r.instantly_created} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
            </div>
            <div className="border-t border-slate-100 py-1.5"><input name="move_in_schedule_url" type="url" defaultValue={r.move_in_schedule_url ?? ""} className={inp} placeholder="https://…" /></div>
            <div className="border-t border-slate-100 py-1.5"><SaveButton /></div>
          </form>
        ))}
      </div>
    </div>
  );
}
