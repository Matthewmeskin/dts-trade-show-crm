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
  "minmax(170px,1.4fr) 116px 52px 116px 116px 104px 104px 78px 92px 78px 124px 116px 128px 128px 48px 64px";

// Ghost inputs: look like plain text until you click in.
const inp =
  "w-full rounded bg-transparent px-1.5 py-1 text-xs text-slate-700 outline-none transition hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-dts-maroon";
const ro = "px-1.5 py-1 text-xs text-slate-500";
const head = "px-1.5 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400";
const cell = "border-t border-slate-100 py-1";

function SavingDot() {
  const { pending } = useFormStatus();
  return <span className="text-[10px] text-slate-400">{pending ? "Saving…" : ""}</span>;
}

export function SalesGrid({ rows }: { rows: SalesGridRow[] }) {
  // Save the row when focus leaves it entirely (auto-save, no Save button).
  const autosave = (e: React.FocusEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.requestSubmit();
  };
  const saveNow = (e: React.ChangeEvent<HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1380px] items-center gap-x-1" style={{ gridTemplateColumns: COLS }}>
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
        <div className={head} />

        {rows.map((r) => (
          <form key={r.id} action={updateShowSales} onBlur={autosave} className={`contents ${r.past ? "opacity-60" : ""}`}>
            <input type="hidden" name="id" value={r.id} />

            <div className={`${cell} pl-1.5`}>
              <Link href={`/shows/${r.id}`} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                {r.showName}{r.editionYear ? <span className="ml-1 text-slate-400">{r.editionYear}</span> : null}
              </Link>
            </div>
            <div className={`${cell} ${ro}`}>{r.showDates}</div>
            <div className={cell}><input name="exhibitor_count" type="number" defaultValue={r.exhibitor_count ?? ""} className={inp} /></div>
            <div className={cell}><input name="industry_vertical" defaultValue={r.industry_vertical ?? ""} className={inp} /></div>
            <div className={cell}><input name="show_management_company" defaultValue={r.show_management_company ?? ""} className={inp} /></div>
            <div className={`${cell} ${ro}`}>{r.advWhse}</div>
            <div className={`${cell} ${ro}`}>{r.direct}</div>
            <div className={`${cell} ${ro}`}>{r.startCall}</div>
            <div className={cell}>
              <div className={ro}>{r.emailTeam}</div>
              <label className="flex items-center gap-1 px-1.5 text-[10px] text-slate-400">
                <input type="checkbox" name="emailed_two_weeks" defaultChecked={r.emailed_two_weeks} onChange={saveNow} className="h-3 w-3 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
                sent
              </label>
            </div>
            <div className={`${cell} ${ro}`}>{r.weekBefore}</div>
            <div className={cell}><input name="sales_people" defaultValue={r.sales_people ?? ""} className={inp} /></div>
            <div className={cell}><input name="lead_gen_owner" defaultValue={r.lead_gen_owner ?? ""} className={inp} /></div>
            <div className={cell}><input name="lead_gen_start_date" type="date" defaultValue={r.lead_gen_start_date ?? ""} className={inp} /></div>
            <div className={cell}><input name="lead_gen_completion_date" type="date" defaultValue={r.lead_gen_completion_date ?? ""} className={inp} /></div>
            <div className={`${cell} pl-2`}>
              <input type="checkbox" name="instantly_created" defaultChecked={r.instantly_created} onChange={saveNow} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
            </div>
            <div className={`${cell} ${ro}`}><SavingDot /></div>
          </form>
        ))}
      </div>
    </div>
  );
}
