"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton, inputClass } from "@/components/form";
import {
  CHANNELS,
  OUTCOMES,
  SIGNAL_TYPES,
  bookingBlockers,
  type Qualification,
} from "@/lib/partners";
import {
  addPartnerContact,
  addPartnerShow,
  addSignal,
  bookCall,
  closeCall,
  logTouch,
  type PartnerState,
} from "../actions";

const empty: PartnerState = { error: null };
const small = inputClass.replace("py-2", "py-1.5");

/** Clears a form after a successful save, and shows the result. */
function useResetOnOk(state: PartnerState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

function Result({ state, okText = "Saved." }: { state: PartnerState; okText?: string }) {
  if (state.error) {
    return (
      <div className="text-sm text-dts-maroon">
        {state.error}
        {state.problems?.length ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return state.ok ? <span className="text-sm text-emerald-600">{state.message ?? okText}</span> : null;
}

type Show = { id: string; label: string };

export function TouchForm({
  partnerId,
  openSignals,
}: {
  partnerId: string;
  openSignals: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(logTouch, empty);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-2.5">
      <input type="hidden" name="partner_id" value={partnerId} />
      <div className="flex flex-wrap gap-2">
        <select name="channel" defaultValue="call" className={`${small} w-auto`} aria-label="Channel">
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" name="reached" className="h-4 w-4 accent-dts-maroon" />
          Reached them (a real conversation)
        </label>
      </div>
      {openSignals.length ? (
        <select name="signal_id" defaultValue={openSignals[0].id} className={small} aria-label="Signal this works">
          <option value="">Not working a signal</option>
          {openSignals.map((s) => (
            <option key={s.id} value={s.id}>
              Works signal: {s.label}
            </option>
          ))}
        </select>
      ) : null}
      <textarea name="note" rows={2} placeholder="What happened" className={small} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="next_step" placeholder="Next step (optional)" className={small} />
        <input name="next_step_on" type="date" className={small} aria-label="Next step date" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Logging…">Log touch</SubmitButton>
        <Result state={state} okText="Logged." />
      </div>
    </form>
  );
}

export function SignalForm({ partnerId, shows }: { partnerId: string; shows: Show[] }) {
  const [state, action] = useActionState(addSignal, empty);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-2.5">
      <input type="hidden" name="partner_id" value={partnerId} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select name="signal_type" defaultValue="" className={small} aria-label="Signal" required>
          <option value="" disabled>
            What was the signal?
          </option>
          {SIGNAL_TYPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input name="occurred_on" type="date" className={small} aria-label="When" />
      </div>
      <select name="show_id" defaultValue="" className={small} aria-label="Show">
        <option value="">No particular show</option>
        {shows.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <input name="note" placeholder="Detail (page visited, who referred them…)" className={small} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Adding…">Add signal</SubmitButton>
        <Result state={state} okText="Added to the worklist." />
      </div>
    </form>
  );
}

export function AddShowForm({ partnerId, shows }: { partnerId: string; shows: Show[] }) {
  const [state, action] = useActionState(addPartnerShow, empty);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <select name="show_id" defaultValue="" className={`${small} min-w-0 flex-1`} aria-label="Show" required>
        <option value="" disabled>
          Add a show they work…
        </option>
        {shows.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <input name="client_count" inputMode="numeric" placeholder="Clients" className={`${small} w-24`} aria-label="Clients at this show" />
      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      <Result state={state} okText="Added." />
    </form>
  );
}

export function AddContactForm({ partnerId }: { partnerId: string }) {
  const [state, action] = useActionState(addPartnerContact, empty);
  const ref = useResetOnOk(state);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-dts-maroon hover:underline">
        + Add a person
      </button>
    );
  }
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input name="first_name" placeholder="First name" className={small} />
      <input name="last_name" placeholder="Last name" className={small} />
      <input name="title" placeholder="Title (who makes the shipping call?)" className={`${small} col-span-2`} />
      <input name="email" type="email" placeholder="Email" className={small} />
      <input name="phone" placeholder="Phone" className={small} />
      <div className="col-span-2 flex items-center gap-3">
        <SubmitButton pendingLabel="Adding…">Add person</SubmitButton>
        <Result state={state} okText="Added." />
      </div>
    </form>
  );
}

/**
 * Book a discovery call. The three qualification boxes start from what the
 * CRM can see, but the admin ticks them - and the third (they agreed to the
 * time themselves) is theirs alone. Nothing saves until all three hold and the
 * handoff note is written.
 */
export function BookCallForm({
  partnerId,
  suggestion,
  reps,
  defaultRepId,
  contacts,
  defaults,
}: {
  partnerId: string;
  suggestion: Qualification;
  reps: { id: string; name: string; bookingUrl: string | null }[];
  defaultRepId: string | null;
  contacts: { id: string; name: string }[];
  defaults: { signal: string; showsNote: string; clientCount: number | null; pain: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: PartnerState, fd: FormData) => {
    const r = await bookCall(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, empty);
  const [q, setQ] = useState({ influence: suggestion.influence, show: suggestion.showSoon, agreed: false });
  const [repId, setRepId] = useState(defaultRepId ?? "");
  const [text, setText] = useState({ signal: defaults.signal, shows: defaults.showsNote, pain: defaults.pain, when: "" });
  const rep = reps.find((r) => r.id === repId);

  const blockers = bookingBlockers({
    q_influence: q.influence,
    q_show_120: q.show,
    q_agreed_time: q.agreed,
    signal: text.signal,
    shows_note: text.shows,
    shipping_pain: text.pain,
    rep_id: repId,
    scheduled_at: text.when,
  });

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark"
        >
          Book a qualified call
        </button>
        {state.ok ? <span className="text-sm text-emerald-600">Booked. The rep owes an outcome within 24 hours of the call.</span> : null}
      </div>
    );
  }

  const box = (key: "influence" | "show" | "agreed", name: string, label: string, hint: string) => (
    <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        checked={q[key]}
        onChange={(e) => setQ((v) => ({ ...v, [key]: e.target.checked }))}
        className="mt-0.5 h-4 w-4 accent-dts-maroon"
      />
      <span>
        {label}
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
    </label>
  );

  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <input type="hidden" name="partner_id" value={partnerId} />
      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Book the call only if</h4>
        <div className="grid gap-2">
          {box(
            "influence",
            "q_influence",
            "They influence freight for 3+ exhibitors, or they're a GSC or organizer",
            suggestion.influence ? "The CRM agrees from their type / client count." : "The CRM doesn't show this yet — confirm it on the call.",
          )}
          {box(
            "show",
            "q_show_120",
            "They have a show in the next 120 days",
            suggestion.nextShow
              ? `Next linked show: ${suggestion.nextShow.name} (${suggestion.nextShow.start}).`
              : "No linked show in the next 120 days — add it under Shows if they named one.",
          )}
          {box("agreed", "q_agreed_time", "They agreed to the time themselves", "Not \"send me info\". That's a touch — log it and set a next step.")}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Rep</span>
          <select name="rep_id" value={repId} onChange={(e) => setRepId(e.target.value)} className={small}>
            <option value="">Pick the rep…</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {rep?.bookingUrl ? (
            <a href={rep.bookingUrl} target="_blank" rel="noreferrer" className="block text-xs font-medium text-sky-700 hover:underline">
              Open {rep.name.split(" ")[0]}&apos;s booking link ↗
            </a>
          ) : rep ? (
            <span className="block text-xs text-slate-400">No booking link on file — an admin can add it on Users.</span>
          ) : null}
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Call time (Pacific)</span>
          <input
            name="scheduled_at"
            type="datetime-local"
            value={text.when}
            onChange={(e) => setText((t) => ({ ...t, when: e.target.value }))}
            className={small}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Who&apos;s on the call</span>
          <select name="contact_id" defaultValue={contacts[0]?.id ?? ""} className={small}>
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Exhibitor clients</span>
          <input name="client_count" inputMode="numeric" defaultValue={defaults.clientCount ?? ""} className={small} />
        </label>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Handoff note for the rep</h4>
        <input
          name="signal"
          value={text.signal}
          onChange={(e) => setText((t) => ({ ...t, signal: e.target.value }))}
          placeholder="Signal — what brought them in"
          className={small}
        />
        <textarea
          name="shows_note"
          rows={2}
          value={text.shows}
          onChange={(e) => setText((t) => ({ ...t, shows: e.target.value }))}
          placeholder="Shows — their next shows, and clients at each"
          className={small}
        />
        <textarea
          name="shipping_pain"
          rows={2}
          value={text.pain}
          onChange={(e) => setText((t) => ({ ...t, pain: e.target.value }))}
          placeholder="Shipping pain — what's going wrong today, in their words"
          className={small}
        />
      </div>

      {blockers.length ? (
        <ul className="space-y-1 text-xs text-amber-800">
          {blockers.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={blockers.length > 0}
          className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Book call
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          Cancel
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

/** The rep's 24-hour loop: what happened on the call. */
export function CloseCallForm({ callId, partnerId }: { callId: string; partnerId: string }) {
  const [state, action] = useActionState(closeCall, empty);
  const [status, setStatus] = useState("held");
  return (
    <form action={action} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="id" value={callId} />
      <input type="hidden" name="partner_id" value={partnerId} />
      <div className="flex flex-wrap gap-3 text-sm">
        {[
          ["held", "Held"],
          ["no_show", "No-show"],
          ["canceled", "Canceled"],
        ].map(([v, l]) => (
          <label key={v} className="flex items-center gap-1.5">
            <input type="radio" name="status" value={v} checked={status === v} onChange={() => setStatus(v)} className="accent-dts-maroon" />
            {l}
          </label>
        ))}
      </div>
      {status === "held" ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {OUTCOMES.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5">
              <input type="radio" name="outcome" value={o.value} required className="accent-dts-maroon" />
              {o.label}
            </label>
          ))}
        </div>
      ) : null}
      <textarea name="outcome_note" rows={2} placeholder="What they said, what we agreed" className={small} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="next_step" placeholder="Next step (optional)" className={small} />
        <input name="next_step_on" type="date" className={small} aria-label="Next step date" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Close the loop</SubmitButton>
        <Result state={state} />
      </div>
    </form>
  );
}
