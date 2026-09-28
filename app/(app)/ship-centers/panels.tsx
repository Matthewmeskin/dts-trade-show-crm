"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, SubmitButton, inputClass } from "@/components/form";
import { formatShortDate } from "@/lib/format";
import { addExistingShipShow, addNewShipShow, saveShipCenter, type ShipState } from "./actions";

const empty: ShipState = { error: null };

/** Pick a GSC partner and go to its Shipping Center page. */
export function StartPicker({ gscs }: { gscs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [id, setId] = useState("");
  if (!gscs.length) return <p className="text-sm text-slate-400">Every GSC partner already has one.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <select value={id} onChange={(e) => setId(e.target.value)} className={`${inputClass} max-w-sm`} aria-label="GSC">
        <option value="">Choose a GSC…</option>
        {gscs.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!id}
        onClick={() => router.push(`/ship-centers/${id}`)}
        className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start
      </button>
    </div>
  );
}

/** The GSC's kit link code and what its exhibitors see. */
export function DetailsForm({
  partnerId,
  suggestedCode,
  hasCode,
  values,
  uploadReady = false,
}: {
  partnerId: string;
  suggestedCode: string;
  hasCode: boolean;
  /** Vercel Blob is set up, so a logo file can be uploaded. */
  uploadReady?: boolean;
  values: { code: string | null; public_name: string | null; ship_phone: string | null; ship_email: string | null; logo_url: string | null; ship_manifest_to: string | null };
}) {
  const [state, action] = useActionState(saveShipCenter, empty);
  const [fileError, setFileError] = useState<string | null>(null);
  const err: Record<string, string | undefined> = { ...(state.fieldErrors ?? {}), ...(fileError ? { logo_url: fileError } : {}) };
  return (
    <form action={action} className="space-y-4 p-5">
      <input type="hidden" name="partner_id" value={partnerId} />
      <Field
        label="Kit link code"
        htmlFor="code"
        required
        error={err.code}
        hint={
          hasCode
            ? "Goes in every kit link. If you change it, old links keep working."
            : "Goes in every kit link, so pick it once. Lowercase, like acme-expo."
        }
      >
        <input id="code" name="code" defaultValue={values.code ?? suggestedCode} className={`${inputClass} font-mono`} />
      </Field>
      <Field label="Name exhibitors see" htmlFor="public_name" hint="Leave blank to use the partner name.">
        <input id="public_name" name="public_name" defaultValue={values.public_name ?? ""} className={inputClass} />
      </Field>
      <Field label="Phone for exhibitors" htmlFor="ship_phone">
        <input id="ship_phone" name="ship_phone" defaultValue={values.ship_phone ?? ""} className={inputClass} />
      </Field>
      <Field label="Email for exhibitors" htmlFor="ship_email" error={err.ship_email}>
        <input id="ship_email" name="ship_email" type="email" defaultValue={values.ship_email ?? ""} className={inputClass} />
      </Field>
      <Field
        label="Manifest and outbound list go to"
        htmlFor="ship_manifest_to"
        error={err.ship_manifest_to}
        hint="Their warehouse or show desk. Several addresses with commas. Blank: the exhibitor email above."
      >
        <input id="ship_manifest_to" name="ship_manifest_to" defaultValue={values.ship_manifest_to ?? ""} className={inputClass} />
      </Field>
      {uploadReady ? (
        <Field label="Logo" htmlFor="logo_file" error={err.logo_url} hint="PNG, JPEG or WebP, under 500 KB. We resize and re-save it as a PNG.">
          <div className="flex flex-wrap items-center gap-3">
            {values.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- their current logo, any host
              <img src={values.logo_url} alt="" className="h-10 w-auto max-w-[160px] rounded border border-slate-200 bg-white object-contain p-1" />
            ) : null}
            <input
              id="logo_file"
              name="logo_file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Checked here too: a big file never reaches the server.
                if (f && f.size > 500 * 1024) {
                  setFileError("Keep the logo under 500 KB.");
                  e.target.value = "";
                } else setFileError(null);
              }}
            />
          </div>
          <input type="hidden" name="logo_url" value={values.logo_url ?? ""} />
        </Field>
      ) : (
        <Field label="Logo link" htmlFor="logo_url" error={err.logo_url} hint="An https:// link to their logo image. Upload comes once Vercel Blob is set up.">
          <input id="logo_url" name="logo_url" defaultValue={values.logo_url ?? ""} className={inputClass} />
        </Field>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{hasCode ? "Save" : "Save and start"}</SubmitButton>
        {state.error ? <p className="text-sm text-dts-maroon">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}

type Choice = { id: string; label: string; start: string | null; otherGsc: string | null };

/** Add a show this GSC runs: a new one, or one the CRM already has. */
export function AddShowPanel({
  partnerId,
  gscName,
  canAdd,
  blockedReason,
  choices,
  venues,
}: {
  partnerId: string;
  gscName: string;
  canAdd: boolean;
  blockedReason: string | null;
  choices: Choice[];
  venues: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newState, newAction] = useActionState(addNewShipShow, empty);
  const [oldState, oldAction] = useActionState(addExistingShipShow, empty);
  const [pick, setPick] = useState("");
  const picked = choices.find((c) => c.id === pick);
  const err = newState.fieldErrors ?? {};

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => setOpen(true)}
          className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add a show {gscName} runs
        </button>
        {blockedReason ? <span className="text-sm text-slate-500">{blockedReason}</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {(["new", "existing"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {m === "new" ? "A new show" : "A show already in the CRM"}
          </button>
        ))}
      </div>

      {mode === "new" ? (
        <form action={newAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="partner_id" value={partnerId} />
          <Field label="Show name" htmlFor="new_show_name" required error={err.show_name} className="sm:col-span-2">
            <input id="new_show_name" name="show_name" className={inputClass} placeholder="As the GSC's kit names it" />
          </Field>
          <Field label="Opens" htmlFor="new_start" required error={err.show_start_date}>
            <input id="new_start" name="show_start_date" type="date" className={inputClass} />
          </Field>
          <Field label="Closes" htmlFor="new_end" required error={err.show_end_date}>
            <input id="new_end" name="show_end_date" type="date" className={inputClass} />
          </Field>
          <Field label="Venue" htmlFor="new_venue" hint="Optional. Skip it if the venue isn't in the CRM yet.">
            <select id="new_venue" name="venue_id" className={inputClass} defaultValue="">
              <option value="">Not set</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Exhibitor kit link" htmlFor="new_kit" error={err.exhibitor_manual_url} hint="Optional now; the next page can read it.">
            <input id="new_kit" name="exhibitor_manual_url" className={inputClass} placeholder="https://" />
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <SubmitButton pendingLabel="Adding…">Add and set up</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
              Cancel
            </button>
            {newState.error ? <p className="text-sm text-dts-maroon">{newState.error}</p> : null}
          </div>
        </form>
      ) : (
        <form action={oldAction} className="space-y-3">
          <input type="hidden" name="partner_id" value={partnerId} />
          <Field label="Show" htmlFor="existing_show">
            <select id="existing_show" name="show_id" value={pick} onChange={(e) => setPick(e.target.value)} className={inputClass}>
              <option value="">Choose an upcoming show…</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {formatShortDate(c.start)}
                  {c.otherGsc ? ` (GSC: ${c.otherGsc})` : ""}
                </option>
              ))}
            </select>
          </Field>
          {picked?.otherGsc ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              The CRM says <strong>{picked.otherGsc}</strong> is the GSC for {picked.label}. A Shipping Center only runs on
              shows {gscName} runs, so this is usually the wrong show.
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" name="confirm_gsc" />
                The CRM is out of date: {gscName} runs this show.
              </label>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Adding…">Add and set up</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
              Cancel
            </button>
            {oldState.error ? <p className="text-sm text-dts-maroon">{oldState.error}</p> : null}
          </div>
        </form>
      )}
    </div>
  );
}
