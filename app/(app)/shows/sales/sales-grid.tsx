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
  show_management_company: string | null; // shown as "Decorator"
  advWhse: string; // read-only window from the show's advance-warehouse dates
  direct: string; // read-only window from the show's direct-to-show dates
  sales_people: string | null;
  lead_gen_owner: string | null;
  lead_gen_start_date: string | null;
  lead_gen_completion_date: string | null;
  emailed_two_weeks: boolean;
  instantly_created: boolean;
};

const COLS =
  "minmax(180px,1.4fr) 148px 68px minmax(120px,1fr) minmax(118px,1fr) 118px 118px 82px 118px 82px minmax(120px,1fr) 110px 120px 120px 46px 58px";

// Ghost inputs: look like plain text until you focus them.
const inp =
  "w-full rounded bg-transparent px-1.5 py-1 text-xs text-slate-700 outline-none transition hover:bg-white focus:bg-white focus:ring-1 focus:ring-dts-maroon";
// Number field without the native spinner arrows (they steal width and clip the count).
const numInp = `${inp} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;
const ro = "min-w-0 truncate text-xs text-slate-500";
const head =
  "flex items-center px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400";
// Every row cell shares one height so rows line up cleanly.
const cellBase = "flex min-h-[44px] items-center border-t border-slate-100 px-1";

function SavingDot() {
  const { pending } = useFormStatus();
  return pending ? <span className="text-[10px] text-slate-400">Saving…</span> : null;
}

export function SalesGrid({ rows }: { rows: SalesGridRow[] }) {
  // Save the row when focus leaves it entirely (auto-save, no Save button).
  const autosave = (e: React.FocusEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.requestSubmit();
  };
  const saveNow = (e: React.ChangeEvent<HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1456px]" style={{ gridTemplateColumns: COLS }}>
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
        <div className={`${head} justify-center`}>Inst</div>
        <div className={head} />

        {rows.map((r, i) => {
          // Zebra banding + dimming for past shows (real cells, since a
          // display:contents form can't carry a background or opacity).
          const band = i % 2 === 1 ? "bg-slate-50/70" : "bg-white";
          const cell = `${cellBase} ${band} ${r.past ? "opacity-55" : ""}`;
          return (
            <form key={r.id} action={updateShowSales} onBlur={autosave} className="contents">
              <input type="hidden" name="id" value={r.id} />

              <div className={`${cell} pl-3`}>
                <Link
                  href={`/shows/${r.id}`}
                  className="min-w-0 truncate text-sm font-medium text-slate-900 hover:text-dts-maroon"
                >
                  {r.showName}
                  {r.editionYear ? <span className="ml-1 text-slate-400">{r.editionYear}</span> : null}
                </Link>
              </div>
              <div className={cell}><span className={ro}>{r.showDates}</span></div>
              <div className={cell}><input name="exhibitor_count" type="number" inputMode="numeric" defaultValue={r.exhibitor_count ?? ""} className={numInp} /></div>
              <div className={cell}><input name="industry_vertical" defaultValue={r.industry_vertical ?? ""} className={inp} /></div>
              <div className={cell}><input name="show_management_company" defaultValue={r.show_management_company ?? ""} className={inp} /></div>
              <div className={cell}><span className={ro}>{r.advWhse}</span></div>
              <div className={cell}><span className={ro}>{r.direct}</span></div>
              <div className={cell}><span className={ro}>{r.startCall}</span></div>
              <div className={`${cell} justify-between gap-1`}>
                <span className={`${ro} tabular-nums`}>{r.emailTeam}</span>
                <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                  <input type="checkbox" name="emailed_two_weeks" defaultChecked={r.emailed_two_weeks} onChange={saveNow} className="h-3.5 w-3.5 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
                  sent
                </label>
              </div>
              <div className={cell}><span className={ro}>{r.weekBefore}</span></div>
              <div className={cell}><input name="sales_people" defaultValue={r.sales_people ?? ""} className={inp} /></div>
              <div className={cell}><input name="lead_gen_owner" defaultValue={r.lead_gen_owner ?? ""} className={inp} /></div>
              <div className={cell}><input name="lead_gen_start_date" type="date" defaultValue={r.lead_gen_start_date ?? ""} className={inp} /></div>
              <div className={cell}><input name="lead_gen_completion_date" type="date" defaultValue={r.lead_gen_completion_date ?? ""} className={inp} /></div>
              <div className={`${cell} justify-center`}>
                <input type="checkbox" name="instantly_created" defaultChecked={r.instantly_created} onChange={saveNow} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
              </div>
              <div className={`${cell} justify-center`}><SavingDot /></div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
