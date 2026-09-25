"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeSalesStep, updateShowSales } from "../actions";
import { joinReps, parseReps, type CompletableStep } from "@/lib/sales";

export type NextActionCell = {
  kind: string;
  label: string;
  date: string;
  state: "overdue" | "due_soon" | "later" | "done" | "none";
  daysOut: number;
};

export type SalesGridRow = {
  id: string;
  showName: string;
  editionYear: number | null;
  showDates: string;
  next: NextActionCell | null;
  startCall: string;
  emailTeam: string;
  weekBefore: string;
  past: boolean;
  exhibitor_count: number | null;
  /** Exhibitors linked to this show in the CRM, as a second opinion on the count. */
  rosterCount: number;
  industry_vertical: string | null;
  show_management_company: string | null; // shown as "Decorator"
  advWhse: string; // read-only window from the show's advance-warehouse dates
  direct: string; // read-only window from the show's direct-to-show dates
  sales_people: string | null;
  lead_gen_owner: string | null;
  lead_gen_start_date: string | null;
  lead_gen_completion_date: string | null;
  emailed_two_weeks: boolean;
  week_before_sent: boolean;
  instantly_created: boolean;
};

const COLS =
  "minmax(200px,1.4fr) 148px 190px 84px minmax(120px,1fr) minmax(118px,1fr) 118px 118px 82px 118px 118px minmax(180px,1.2fr) 110px 120px 120px 46px 58px";

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
const check = "h-3.5 w-3.5 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon";

const GROUP_LABEL: Record<NextActionCell["state"], string> = {
  overdue: "Overdue",
  due_soon: "Due this week",
  later: "Later",
  none: "No show date",
  done: "Opened",
};

const STATE_STYLE: Record<NextActionCell["state"], string> = {
  overdue: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  due_soon: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  later: "bg-slate-100 text-slate-600",
  done: "text-slate-400",
  none: "text-slate-400",
};

const COMPLETABLE = new Set<string>(["start_call", "email_team", "week_before"]);

function NextActionBadge({ next }: { next: SalesGridRow["next"] }) {
  if (!next) return <span className={ro}>—</span>;
  const when =
    next.state === "done"
      ? ""
      : next.daysOut === 0
        ? "today"
        : next.daysOut < 0
          ? `${-next.daysOut}d overdue`
          : `in ${next.daysOut}d`;
  const completable = next.state !== "done" && COMPLETABLE.has(next.kind);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        title={`${next.label} · ${next.date}`}
        className={`inline-flex min-w-0 items-baseline gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium leading-4 ${STATE_STYLE[next.state]}`}
      >
        <span className="truncate">{next.label}</span>
        {when ? <span className="shrink-0 font-normal opacity-80">{when}</span> : null}
      </span>
      {completable ? (
        // Completes the step with the same fields the row edits by hand; the
        // button submits this row's form to a different action.
        <button
          type="submit"
          formAction={completeSalesStep}
          name="step"
          value={next.kind as CompletableStep}
          title={`Mark "${next.label}" done`}
          className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        >
          ✓ Done
        </button>
      ) : null}
    </span>
  );
}

/**
 * Sales reps as chips with a pick-list, stored in the same free-text field the
 * Overview form edits. Typing a new name adds it; the list offers the names
 * already in use so "Kevin, Yves, Jean" and "Jean, Kevin, Yves" stop being two
 * different teams.
 */
function RepPicker({ value, options, listId }: { value: string | null; options: string[]; listId: string }) {
  const [names, setNames] = useState<string[]>(() => parseReps(value));
  const [draft, setDraft] = useState("");
  const hidden = useRef<HTMLInputElement>(null);

  const commit = (next: string[]) => {
    setNames(next);
    // The form autosaves when focus leaves the row; a chip change should not
    // wait for that, so submit now with the new value in the hidden field.
    requestAnimationFrame(() => hidden.current?.form?.requestSubmit());
  };
  const add = (raw: string) => {
    const merged = parseReps([...names, raw].join(", "));
    setDraft("");
    if (merged.length !== names.length) commit(merged);
  };
  const remove = (n: string) => commit(names.filter((x) => x !== n));

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 py-1">
      <input ref={hidden} type="hidden" name="sales_people" value={joinReps(names) ?? ""} />
      {names.map((n) => (
        <span key={n} className="inline-flex items-center gap-0.5 rounded-full bg-dts-blue/10 px-2 py-0.5 text-[11px] font-medium text-dts-blue">
          {n}
          <button type="button" onClick={() => remove(n)} aria-label={`Remove ${n}`} className="ml-0.5 text-dts-blue/60 hover:text-dts-blue">
            ×
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={draft}
        onChange={(e) => {
          // Picking from the datalist fires change with the full name; add it at once.
          const v = e.target.value;
          if (options.some((o) => o.toLowerCase() === v.trim().toLowerCase())) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && names.length) {
            remove(names[names.length - 1]);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={names.length ? "+ add" : "Add a rep…"}
        className={`${inp} min-w-[64px] flex-1 px-1`}
      />
    </div>
  );
}

function SavingDot() {
  const { pending } = useFormStatus();
  return pending ? <span className="text-[10px] text-slate-400">Saving…</span> : null;
}

export function SalesGrid({
  rows,
  grouped,
  repOptions,
  ownerOptions,
}: {
  rows: SalesGridRow[];
  /** Divider rows between urgency groups (off when sorted by show date). */
  grouped: boolean;
  repOptions: string[];
  ownerOptions: string[];
}) {
  const repList = useId();
  const ownerList = useId();
  // Save the row when focus leaves it entirely (auto-save, no Save button).
  const autosave = (e: React.FocusEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.requestSubmit();
  };
  const saveNow = (e: React.ChangeEvent<HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <div className="overflow-x-auto">
      <datalist id={repList}>
        {repOptions.map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id={ownerList}>
        {ownerOptions.map((o) => <option key={o} value={o} />)}
      </datalist>

      <div className="grid min-w-[1780px]" style={{ gridTemplateColumns: COLS }}>
        <div className={`${head} sticky left-0 z-20 bg-white shadow-[inset_-1px_0_0_#e2e8f0]`}>Show</div>
        <div className={head}>Show dates</div>
        <div className={head}>Next action</div>
        <div className={head} title="Exhibitors at the show (typed) · exhibitors linked in the CRM"># Exh</div>
        <div className={head}>Industry</div>
        <div className={head}>Decorator</div>
        <div className={head}>Adv whse</div>
        <div className={head}>Direct</div>
        <div className={head}>Start call</div>
        <div className={head}>Email team</div>
        <div className={head}>Wk before</div>
        <div className={head}>Sales reps</div>
        <div className={head}>Lead gen</div>
        <div className={head}>LG start</div>
        <div className={head}>LG done</div>
        <div className={`${head} justify-center`} title="Instantly campaign created">Inst</div>
        <div className={head} />

        {rows.map((r, i) => {
          const state = r.next?.state ?? "none";
          const prev = i > 0 ? (rows[i - 1].next?.state ?? "none") : null;
          const divider = grouped && state !== prev;
          // Zebra banding + dimming for past shows (real cells, since a
          // display:contents form can't carry a background or opacity).
          const band = i % 2 === 1 ? "bg-slate-50/70" : "bg-white";
          const cell = `${cellBase} ${band} ${r.past ? "opacity-55" : ""}`;
          // The sticky show cell must be fully opaque — a translucent band or a
          // dimmed past row lets the columns scrolling underneath ghost through
          // it — so it gets its own solid background and a dimmed text colour.
          const stickyCell = `${cellBase} ${i % 2 === 1 ? "bg-slate-50" : "bg-white"} shadow-[inset_-1px_0_0_#e2e8f0]`;
          // An overdue row gets a red edge so it reads from across the room.
          const edge = state === "overdue" ? "border-l-2 border-l-rose-500" : "border-l-2 border-l-transparent";
          return (
            <div key={r.id} className="contents">
              {divider ? (
                <div className="col-span-full border-t border-slate-200 bg-slate-50 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {/* The label sticks with the show column so it survives a horizontal scroll. */}
                  <span className="sticky left-0 inline-flex items-center gap-2 px-3">
                    {GROUP_LABEL[state]}
                    <span className="font-normal normal-case tracking-normal text-slate-400">
                      {rows.filter((x) => (x.next?.state ?? "none") === state).length}
                    </span>
                  </span>
                </div>
              ) : null}
              <form action={updateShowSales} onBlur={autosave} className="contents">
                <input type="hidden" name="id" value={r.id} />

                <div className={`${stickyCell} ${edge} sticky left-0 z-10 pl-3`}>
                  <Link
                    href={`/shows/${r.id}`}
                    title={r.showName}
                    className={`min-w-0 truncate text-sm font-medium hover:text-dts-maroon ${r.past ? "text-slate-400" : "text-slate-900"}`}
                  >
                    {r.showName}
                    {r.editionYear ? <span className="ml-1 text-slate-400">{r.editionYear}</span> : null}
                  </Link>
                </div>
                <div className={cell}><span className={ro}>{r.showDates}</span></div>
                <div className={`${cell} pr-2`}><NextActionBadge next={r.next} /></div>
                <div className={`${cell} gap-1`}>
                  <input name="exhibitor_count" type="number" inputMode="numeric" defaultValue={r.exhibitor_count ?? ""} placeholder={r.rosterCount ? String(r.rosterCount) : ""} title="Exhibitors at the show, from the organizer's list" className={`${numInp} w-12`} />
                  {r.rosterCount ? (
                    <span title={`${r.rosterCount} exhibitor${r.rosterCount === 1 ? "" : "s"} linked to this show in the CRM`} className="shrink-0 text-[10px] text-slate-400">
                      {r.rosterCount} in CRM
                    </span>
                  ) : null}
                </div>
                <div className={cell}><input name="industry_vertical" defaultValue={r.industry_vertical ?? ""} title={r.industry_vertical ?? ""} className={inp} /></div>
                <div className={cell}><input name="show_management_company" defaultValue={r.show_management_company ?? ""} title={r.show_management_company ?? ""} className={inp} /></div>
                <div className={cell}><span className={ro}>{r.advWhse}</span></div>
                <div className={cell}><span className={ro}>{r.direct}</span></div>
                <div className={cell}>
                  <span className={ro} title={r.lead_gen_start_date ? `Calling started ${r.lead_gen_start_date}` : "Marked done by setting LG start"}>
                    {r.startCall}
                    {r.lead_gen_start_date ? <span className="ml-1 text-emerald-600">✓</span> : null}
                  </span>
                </div>
                <div className={`${cell} justify-between gap-1`}>
                  <span className={`${ro} tabular-nums`}>{r.emailTeam}</span>
                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                    <input type="checkbox" name="emailed_two_weeks" defaultChecked={r.emailed_two_weeks} onChange={saveNow} className={check} />
                    sent
                  </label>
                </div>
                <div className={`${cell} justify-between gap-1`}>
                  <span className={`${ro} tabular-nums`}>{r.weekBefore}</span>
                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                    <input type="checkbox" name="week_before_sent" defaultChecked={r.week_before_sent} onChange={saveNow} className={check} />
                    sent
                  </label>
                </div>
                <div className={cell}><RepPicker value={r.sales_people} options={repOptions} listId={repList} /></div>
                <div className={cell}><input name="lead_gen_owner" list={ownerList} defaultValue={r.lead_gen_owner ?? ""} className={inp} /></div>
                <div className={cell}><input name="lead_gen_start_date" type="date" defaultValue={r.lead_gen_start_date ?? ""} className={inp} /></div>
                <div className={cell}><input name="lead_gen_completion_date" type="date" defaultValue={r.lead_gen_completion_date ?? ""} className={inp} /></div>
                <div className={`${cell} justify-center`}>
                  <input type="checkbox" name="instantly_created" defaultChecked={r.instantly_created} onChange={saveNow} className="h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon" />
                </div>
                <div className={`${cell} justify-center`}><SavingDot /></div>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
