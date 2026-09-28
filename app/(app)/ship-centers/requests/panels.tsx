"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Field, SubmitButton, inputClass } from "@/components/form";
import { OFFICE_PHONE, legFreight, legRoute, quoteEmail } from "@/lib/ship-quote";
import { bookLeg, checkNow, closeRequest, sendQuote, type InboxState } from "./actions";

const empty: InboxState = { error: null };

function Result({ state }: { state: InboxState }) {
  if (state.error) return <p className="text-sm text-dts-maroon">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function CheckNowButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<InboxState>(empty);
  return (
    <div className="flex items-center gap-3">
      <Result state={state} />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await checkNow()))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Check now"}
      </button>
    </div>
  );
}

export type QuoteLeg = {
  id: string;
  name: string;
  direction: string;
  city: string | null;
  state: string | null;
  inbound_to: string | null;
  pieces: number | null;
  weight_lbs: number | null;
  packaging: string | null;
  liftgate: boolean;
  inside: boolean;
  last: number | null;
};

/**
 * One price per shipment, one email. The email is written here as you type,
 * so what the exhibitor gets is on screen before it goes, and can be copied
 * into Outlook when the CRM's email is not set up.
 */
export function QuotePanel({
  requestId,
  legs,
  email,
  context,
  emailReady,
}: {
  requestId: string;
  legs: QuoteLeg[];
  email: string;
  context: { publicRef: string; showName: string; year: string; gscName: string; booth: string | null; contactName: string | null; staffName: string | null; staffPhone: string | null };
  emailReady: boolean;
}) {
  const [state, action] = useActionState(sendQuote, empty);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(legs.map((l) => [l.id, l.last ? String(l.last) : ""])),
  );
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const msg = useMemo(() => {
    const lines = legs
      .map((l) => ({ l, n: Number((amounts[l.id] ?? "").replace(/[$,\s]/g, "")) }))
      .filter(({ n }) => Number.isFinite(n) && n > 0)
      .map(({ l, n }) => ({ name: l.name, route: legRoute(l), freight: legFreight(l), amount: n }));
    return lines.length ? quoteEmail({ ...context, lines, note: note || null, officePhone: OFFICE_PHONE }) : null;
  }, [legs, amounts, note, context]);

  return (
    <form action={action} className="space-y-4 p-5">
      <input type="hidden" name="request_id" value={requestId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {legs.map((l) => (
          <Field key={l.id} label={`${l.name} price`} htmlFor={`amount_${l.id}`} hint={`${legRoute(l)}. ${legFreight(l)}`}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                id={`amount_${l.id}`}
                name={`amount_${l.id}`}
                inputMode="decimal"
                value={amounts[l.id] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [l.id]: e.target.value }))}
                className={`${inputClass} pl-6`}
                placeholder="0.00"
              />
            </div>
          </Field>
        ))}
      </div>
      <Field label="Note for the exhibitor (optional)" htmlFor="note" hint="Goes in the email above the fine print. Accessorials, a pickup window, anything they should know.">
        <textarea id="note" name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>

      {msg ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
            <span>
              To {email} · <span className="font-medium text-slate-700">{msg.subject}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${msg.subject}\n\n${msg.text}`).then(() => setCopied(true));
              }}
              className="font-medium text-dts-blue hover:underline"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="max-h-80 overflow-auto px-4 py-3 font-sans text-sm whitespace-pre-wrap text-slate-700">{msg.text}</pre>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Enter a price to see the email.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {emailReady ? (
          <button
            type="submit"
            name="mode"
            value="email"
            disabled={!msg}
            className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send quote
          </button>
        ) : (
          <a
            href={msg ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.text)}` : undefined}
            aria-disabled={!msg}
            className={`rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark ${msg ? "" : "pointer-events-none opacity-50"}`}
          >
            Open in Outlook
          </a>
        )}
        <button
          type="submit"
          name="mode"
          value="manual"
          disabled={!msg}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          I sent it myself
        </button>
        <Result state={state} />
      </div>
      {!emailReady ? (
        <p className="text-xs text-slate-400">
          The CRM can&apos;t send email yet, so send it from your mailbox, then click &quot;I sent it myself&quot; to record the price.
        </p>
      ) : null}
    </form>
  );
}

export function BookForm({ legId }: { legId: string }) {
  const [state, action] = useActionState(bookLeg, empty);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="leg_id" value={legId} />
      <Field label="Load number" htmlFor={`load_${legId}`} className="w-40">
        <input id={`load_${legId}`} name="load_number" className={`${inputClass} font-mono`} placeholder="From Hyperion" />
      </Field>
      <SubmitButton pendingLabel="Booking…">Mark booked</SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function CloseForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(closeRequest, empty);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-slate-500 hover:text-dts-maroon">
        Cancel or turn down this request…
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="radio" name="closed" value="cancelled" defaultChecked /> The exhibitor cancelled
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="closed" value="rejected" /> We are turning it down
        </label>
      </div>
      <Field label="Note (staff only)" htmlFor="closed_note">
        <input id="closed_note" name="closed_note" className={inputClass} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Closing…">Close request</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">
          Keep it open
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

