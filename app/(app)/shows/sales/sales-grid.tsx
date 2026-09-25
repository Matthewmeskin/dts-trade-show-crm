"use client";

import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore } from "react";
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
  advWhse: string; // formatted advance-warehouse window (kept for the digest/tests)
  direct: string; // formatted direct-to-show window
  /** Raw YYYY-MM-DD values for the editable date pairs. */
  show_start_date: string | null;
  show_end_date: string | null;
  advance_warehouse_open: string | null;
  advance_warehouse_cutoff: string | null;
  direct_to_show_start: string | null;
  direct_to_show_end: string | null;
  sales_people: string | null;
  lead_gen_owner: string | null;
  lead_gen_start_date: string | null;
  lead_gen_completion_date: string | null;
  emailed_two_weeks: boolean;
  week_before_sent: boolean;
  start_call_done: boolean;
  instantly_created: boolean;
};

/**
 * The grid's columns, in order. Widths are pixels so a person can drag them;
 * what they drag to is remembered per browser. `min` stops a column being
 * dragged to nothing.
 */
const COLUMNS = [
  { key: "show", label: "Show", width: 240, min: 140 },
  { key: "dates", label: "Show dates", width: 150, min: 128 },
  { key: "next", label: "Next action", width: 210, min: 120 },
  { key: "exh", label: "# Exh", width: 96, min: 60, title: "Exhibitors at the show (typed) · exhibitors linked in the CRM" },
  { key: "industry", label: "Industry", width: 150, min: 70 },
  { key: "decorator", label: "Decorator", width: 140, min: 70 },
  { key: "adv", label: "Adv whse", width: 150, min: 128 },
  { key: "direct", label: "Direct", width: 150, min: 128 },
  { key: "call", label: "Start call", width: 118, min: 90 },
  { key: "email", label: "Email team", width: 118, min: 90 },
  { key: "week", label: "Wk before", width: 118, min: 90 },
  { key: "reps", label: "Sales reps", width: 200, min: 110 },
  { key: "owner", label: "Lead gen", width: 110, min: 70 },
  { key: "lgStart", label: "LG start", width: 124, min: 110 },
  { key: "lgDone", label: "LG done", width: 124, min: 110 },
  { key: "inst", label: "Inst", width: 48, min: 40, title: "Instantly campaign created", center: true },
  { key: "save", label: "", width: 58, min: 40 },
] as const;
const DEFAULT_WIDTHS = COLUMNS.map((c) => c.width);

/**
 * A tiny per-browser store over localStorage. useSyncExternalStore gives the
 * server and the first client render the same default (no hydration
 * mismatch), then the saved value takes over.
 */
const STORE_EVENT = "sales-grid-prefs";
function subscribe(cb: () => void) {
  window.addEventListener(STORE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(STORE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeKey(key: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private window: the preference just is not remembered */
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}
function useStored(key: string): string | null {
  return useSyncExternalStore(subscribe, () => readKey(key), () => null);
}

// v2: the three date columns became editable and wider; old saved widths
// would squeeze the date pickers, so they are not carried over.
const WIDTHS_KEY = "dts.salesGrid.widths.v3";
const WRAP_KEY = "dts.salesGrid.wrap.v1";

function parseWidths(raw: string | null): number[] {
  if (!raw) return DEFAULT_WIDTHS;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || v.length !== COLUMNS.length) return DEFAULT_WIDTHS;
    return v.map((w, i) => (typeof w === "number" && w >= COLUMNS[i].min ? Math.round(w) : COLUMNS[i].width));
  } catch {
    return DEFAULT_WIDTHS;
  }
}

// Ghost inputs: look like plain text until you focus them.
const inp =
  "w-full rounded bg-transparent px-1.5 py-1 text-xs text-slate-700 outline-none transition hover:bg-white focus:bg-white focus:ring-1 focus:ring-dts-maroon";
// Number field without the native spinner arrows (they steal width and clip the count).
const numInp = `${inp} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;
const roClip = "min-w-0 truncate text-xs text-slate-500";
const roWrap = "min-w-0 whitespace-normal break-words py-1 text-xs leading-4 text-slate-500";
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

const COMPLETABLE = new Set<string>(["lead_gen_done", "start_call", "email_team", "week_before"]);

function NextActionBadge({ next, wrap }: { next: SalesGridRow["next"]; wrap: boolean }) {
  if (!next) return <span className={roClip}>—</span>;
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
    <span className={`flex min-w-0 gap-1.5 ${wrap ? "flex-wrap items-start py-1" : "items-center"}`}>
      <span
        title={`${next.label} · ${next.date}`}
        className={`inline-flex min-w-0 gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium leading-4 ${wrap ? "flex-wrap items-baseline" : "items-baseline"} ${STATE_STYLE[next.state]}`}
      >
        <span className={wrap ? "whitespace-normal break-words" : "truncate"}>{next.label}</span>
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

/**
 * A text field that wraps when wrapping is on. Inputs are single-line by
 * nature, so in wrap mode it becomes a one-row textarea that grows with its
 * content (field-sizing where the browser has it, a row estimate otherwise).
 * Enter never adds a newline — these are one-line values.
 */
function TextCell({
  name,
  value,
  wrap,
  width,
}: {
  name: string;
  value: string | null;
  wrap: boolean;
  width: number;
}) {
  if (!wrap) {
    return <input name={name} defaultValue={value ?? ""} title={value ?? ""} className={inp} />;
  }
  const perLine = Math.max(8, Math.floor((width - 14) / 6.2));
  const rows = Math.max(1, Math.min(6, Math.ceil((value?.length ?? 0) / perLine)));
  return (
    <textarea
      name={name}
      defaultValue={value ?? ""}
      rows={rows}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className={`${inp} block resize-none leading-4 [field-sizing:content]`}
    />
  );
}

/**
 * An editable date range: start above end, each a native date picker. The
 * end picker cannot go before the start, and the server re-checks it.
 */
function DateRangeCell({
  startName,
  endName,
  start,
  end,
  label,
}: {
  startName: string;
  endName: string;
  start: string | null;
  end: string | null;
  label: string;
}) {
  const [from, setFrom] = useState(start?.slice(0, 10) ?? "");
  const [to, setTo] = useState(end?.slice(0, 10) ?? "");
  // An empty picker shows the browser's "mm/dd/yyyy"; keep that faint so a
  // blank date reads as blank rather than as a value.
  const tone = (v: string) => (v ? "" : "text-slate-300 focus:text-slate-700");
  return (
    <div className="flex w-full flex-col gap-0.5 py-1">
      <input
        type="date"
        name={startName}
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        aria-label={`${label} start`}
        className={`${inp} tabular-nums ${tone(from)}`}
      />
      <input
        type="date"
        name={endName}
        value={to}
        onChange={(e) => setTo(e.target.value)}
        min={from || undefined}
        aria-label={`${label} end`}
        className={`${inp} tabular-nums ${tone(to)}`}
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

  // Wrapping is the default; only an explicit "0" (the box unticked) turns it off.
  const wrap = useStored(WRAP_KEY) !== "0";
  const saved = parseWidths(useStored(WIDTHS_KEY));
  // While a column edge is being dragged the widths live here; they are saved
  // once, on release, rather than on every mouse move.
  const [dragging, setDragging] = useState<number[] | null>(null);
  const [activeCol, setActiveCol] = useState<number | null>(null);
  const dragStart = useRef<{ index: number; x: number; width: number; widths: number[] } | null>(null);
  const widths = dragging ?? saved;
  const w = (key: (typeof COLUMNS)[number]["key"]) => widths[COLUMNS.findIndex((c) => c.key === key)];
  const customised = widths.some((x, i) => x !== DEFAULT_WIDTHS[i]);

  const beginResize = (index: number) => (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { index, x: e.clientX, width: widths[index], widths: [...widths] };
    setDragging([...widths]);
    setActiveCol(index);
  };
  const moveResize = (e: React.PointerEvent<HTMLSpanElement>) => {
    const d = dragStart.current;
    if (!d) return;
    const next = [...d.widths];
    next[d.index] = Math.max(COLUMNS[d.index].min, Math.round(d.width + e.clientX - d.x));
    setDragging(next);
  };
  const endResize = () => {
    if (dragStart.current && dragging) writeKey(WIDTHS_KEY, JSON.stringify(dragging));
    dragStart.current = null;
    setDragging(null);
    setActiveCol(null);
  };
  const resetColumn = (index: number) => {
    const next = [...widths];
    next[index] = DEFAULT_WIDTHS[index];
    writeKey(WIDTHS_KEY, JSON.stringify(next));
  };
  const ro = wrap ? roWrap : roClip;
  // Save the row when focus leaves it entirely (auto-save, no Save button).
  const autosave = (e: React.FocusEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.requestSubmit();
  };
  const saveNow = (e: React.ChangeEvent<HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 hover:border-slate-300">
          <input
            type="checkbox"
            checked={wrap}
            onChange={(e) => writeKey(WRAP_KEY, e.target.checked ? null : "0")}
            className={check}
          />
          Wrap long text
        </label>
        {customised ? (
          <button
            type="button"
            onClick={() => writeKey(WIDTHS_KEY, null)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 hover:border-slate-300 hover:text-slate-800"
          >
            Reset column widths
          </button>
        ) : null}
        <span className="text-slate-400">Drag a column&apos;s right edge to widen it · double-click the edge to reset it.</span>
      </div>

    {/* The grid scrolls inside its own box, both ways, so the header row can
        stay frozen at the top while the show column stays frozen at the left.
        A sticky header only sticks inside its nearest scroll container. */}
    <div className="max-h-[calc(100vh-8rem)] overflow-auto overscroll-contain rounded-lg border border-slate-100">
      <datalist id={repList}>
        {repOptions.map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id={ownerList}>
        {ownerOptions.map((o) => <option key={o} value={o} />)}
      </datalist>

      <div
        className={`grid w-max ${dragging ? "cursor-col-resize select-none" : ""}`}
        style={{ gridTemplateColumns: widths.map((x) => `${x}px`).join(" ") }}
      >
        {COLUMNS.map((c, i) => (
          <div
            key={c.key}
            title={"title" in c ? c.title : undefined}
            className={`${head} sticky top-0 bg-white pt-2 shadow-[inset_0_-1px_0_#e2e8f0] ${"center" in c && c.center ? "justify-center" : ""} ${
              i === 0 ? "left-0 z-30 shadow-[inset_-1px_-1px_0_#e2e8f0]" : "z-20"
            }`}
          >
            <span className="truncate">{c.label}</span>
            {c.label ? (
              <span
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${c.label}`}
                title="Drag to resize · double-click to reset"
                onPointerDown={beginResize(i)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onDoubleClick={() => resetColumn(i)}
                className="group absolute -right-1.5 top-0 z-30 flex h-full w-3 cursor-col-resize justify-center"
              >
                <span
                  className={`h-full w-0.5 rounded transition ${
                    activeCol === i ? "bg-dts-maroon" : "bg-transparent group-hover:bg-slate-300"
                  }`}
                />
              </span>
            ) : null}
          </div>
        ))}

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
                    className={`min-w-0 text-sm font-medium hover:text-dts-maroon ${wrap ? "whitespace-normal break-words py-1.5 leading-5" : "truncate"} ${r.past ? "text-slate-400" : "text-slate-900"}`}
                  >
                    {r.showName}
                    {r.editionYear ? <span className="ml-1 text-slate-400">{r.editionYear}</span> : null}
                  </Link>
                </div>
                <div className={cell}><DateRangeCell startName="show_start_date" endName="show_end_date" start={r.show_start_date} end={r.show_end_date} label="Show" /></div>
                <div className={`${cell} pr-2`}><NextActionBadge next={r.next} wrap={wrap} /></div>
                <div className={`${cell} gap-1`}>
                  <input name="exhibitor_count" type="number" inputMode="numeric" defaultValue={r.exhibitor_count ?? ""} placeholder={r.rosterCount ? String(r.rosterCount) : ""} title="Exhibitors at the show, from the organizer's list" className={`${numInp} w-12`} />
                  {r.rosterCount ? (
                    <span title={`${r.rosterCount} exhibitor${r.rosterCount === 1 ? "" : "s"} linked to this show in the CRM`} className="shrink-0 text-[10px] text-slate-400">
                      {r.rosterCount} in CRM
                    </span>
                  ) : null}
                </div>
                <div className={cell}><TextCell name="industry_vertical" value={r.industry_vertical} wrap={wrap} width={w("industry")} /></div>
                <div className={cell}><TextCell name="show_management_company" value={r.show_management_company} wrap={wrap} width={w("decorator")} /></div>
                <div className={cell}><DateRangeCell startName="advance_warehouse_open" endName="advance_warehouse_cutoff" start={r.advance_warehouse_open} end={r.advance_warehouse_cutoff} label="Advance warehouse" /></div>
                <div className={cell}><DateRangeCell startName="direct_to_show_start" endName="direct_to_show_end" start={r.direct_to_show_start} end={r.direct_to_show_end} label="Direct to show" /></div>
                <div className={`${cell} justify-between gap-1`}>
                  <span className={`${ro} tabular-nums`} title="60 days before the show start">{r.startCall}</span>
                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                    <input type="checkbox" name="start_call_done" defaultChecked={r.start_call_done} onChange={saveNow} className={check} />
                    done
                  </label>
                </div>
                <div className={`${cell} justify-between gap-1`}>
                  <span className={`${ro} tabular-nums`} title="14 days before the show start">{r.emailTeam}</span>
                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                    <input type="checkbox" name="emailed_two_weeks" defaultChecked={r.emailed_two_weeks} onChange={saveNow} className={check} />
                    sent
                  </label>
                </div>
                <div className={`${cell} justify-between gap-1`}>
                  <span className={`${ro} tabular-nums`} title="7 days before the show start">{r.weekBefore}</span>
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
    </div>
  );
}
