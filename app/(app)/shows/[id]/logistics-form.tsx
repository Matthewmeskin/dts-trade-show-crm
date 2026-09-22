"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/form";
import { Icon } from "@/components/icons";
import {
  SOURCE_TYPES,
  TIMEZONES,
  verifyBlockers,
  type Logistics,
} from "@/lib/logistics";
import {
  saveLogistics,
  verifyLogistics,
  type LogisticsState,
} from "../logistics-actions";
import type { Tables } from "@/lib/database.types";

type ShowFields = Pick<
  Tables<"shows">,
  | "show_start_date"
  | "show_end_date"
  | "advance_warehouse_name"
  | "advance_warehouse_street1"
  | "direct_to_show_street1"
  | "advance_warehouse_address"
  | "direct_to_show_address"
  | "series_id"
>;

const empty: LogisticsState = { error: null };

export function LogisticsForm({
  showId,
  show,
  logistics,
}: {
  showId: string;
  show: ShowFields;
  logistics: Logistics | null;
}) {
  const [saveState, saveAction] = useActionState(saveLogistics, empty);
  const [verifyState, verifyAction] = useActionState(verifyLogistics, empty);

  // The three fields the verify rule depends on are tracked here so the checklist
  // updates as you type, instead of after a failed round trip.
  const [timezone, setTimezone] = useState(logistics?.timezone ?? "");
  const [sourceUrl, setSourceUrl] = useState(logistics?.source_url ?? "");
  const [sourceType, setSourceType] = useState(logistics?.source_type ?? "");

  const blockers = verifyBlockers(show, {
    timezone: timezone || null,
    source_url: sourceUrl || null,
    source_type: sourceType || null,
  });
  const ready = blockers.length === 0;

  const state = verifyState.error || verifyState.ok ? verifyState : saveState;

  return (
    <form action={saveAction} className="space-y-6">
      <input type="hidden" name="show_id" value={showId} />
      <input
        type="hidden"
        name="previous_notes"
        value={logistics?.dts_public_notes ?? ""}
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon
            name={ready ? "check" : "alert"}
            className={`h-4 w-4 ${ready ? "text-emerald-600" : "text-amber-600"}`}
          />
          <h4 className="text-sm font-semibold text-slate-900">
            {ready
              ? "Ready to verify"
              : `${blockers.length} thing${blockers.length === 1 ? "" : "s"} to fix before this can be verified`}
          </h4>
        </div>
        {ready ? (
          <p className="text-xs text-slate-500">
            Verifying records you as the person who checked it, and the date. The
            page republishes on the next sync.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {blockers.map((b) => (
              <li key={b.field} className="flex gap-2 text-xs text-slate-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                <span>
                  {b.message}
                  {b.fix === "show" ? (
                    <span className="ml-1 text-slate-400">
                      (edit this on the Overview tab)
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="space-y-4">
        <h4 className="font-heading text-sm font-semibold text-slate-900">
          Timing the kit gives in words
        </h4>
        <p className="-mt-2 text-xs text-slate-400">
          The dates live on the Overview tab. These are the parts a kit states as a
          time of day, which the show record has nowhere to put.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Timezone"
            htmlFor="timezone"
            required
            hint="Shown as a label beside every date. Never used to convert one."
          >
            <select
              id="timezone"
              name="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={inputClass}
            >
              <option value="">Select…</option>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Advance warehouse cut-off time"
            htmlFor="advance_cutoff_local"
            hint="Local time, e.g. 15:30."
          >
            <input
              type="time"
              id="advance_cutoff_local"
              name="advance_cutoff_local"
              defaultValue={logistics?.advance_cutoff_local?.slice(0, 5) ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Direct-to-show cut-off time" htmlFor="direct_cutoff_local">
            <input
              type="time"
              id="direct_cutoff_local"
              name="direct_cutoff_local"
              defaultValue={logistics?.direct_cutoff_local?.slice(0, 5) ?? ""}
              className={inputClass}
            />
          </Field>
          <Field
            label="Carrier check-in cut-off time"
            htmlFor="carrier_check_in_cutoff_local"
            hint="The check-in date comes from the marshalling yard cut-off on the show."
          >
            <input
              type="time"
              id="carrier_check_in_cutoff_local"
              name="carrier_check_in_cutoff_local"
              defaultValue={
                logistics?.carrier_check_in_cutoff_local?.slice(0, 5) ?? ""
              }
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <h4 className="font-heading text-sm font-semibold text-slate-900">
          What exhibitors need told
        </h4>
        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Late surcharge note"
            htmlFor="advance_late_surcharge_note"
            hint="What happens if freight arrives after the advance deadline. Facts, in your own words — never copied from the kit."
          >
            <textarea
              id="advance_late_surcharge_note"
              name="advance_late_surcharge_note"
              rows={2}
              defaultValue={logistics?.advance_late_surcharge_note ?? ""}
              className={inputClass}
            />
          </Field>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3.5 py-3">
            <input
              type="checkbox"
              id="targeted_move_in"
              name="targeted_move_in"
              defaultChecked={logistics?.targeted_move_in ?? false}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-dts-maroon focus:ring-dts-maroon"
            />
            <label htmlFor="targeted_move_in" className="text-sm text-slate-700">
              This show uses targeted move-in
              <span className="block text-xs text-slate-400">
                Exhibitors get an assigned window rather than turning up when they
                like — the single most expensive thing to get wrong.
              </span>
            </label>
          </div>

          <Field label="Targeted move-in note" htmlFor="targeted_move_in_note">
            <textarea
              id="targeted_move_in_note"
              name="targeted_move_in_note"
              rows={2}
              defaultValue={logistics?.targeted_move_in_note ?? ""}
              className={inputClass}
            />
          </Field>
          <Field
            label="Marshalling yard note"
            htmlFor="marshalling_yard_note"
            hint="What a driver has to do before the dock."
          >
            <textarea
              id="marshalling_yard_note"
              name="marshalling_yard_note"
              rows={2}
              defaultValue={logistics?.marshalling_yard_note ?? ""}
              className={inputClass}
            />
          </Field>
          <Field
            label="Labelling requirements"
            htmlFor="label_requirements_note"
            hint="Booth number, show name, piece count — whatever this show insists on."
          >
            <textarea
              id="label_requirements_note"
              name="label_requirements_note"
              rows={2}
              defaultValue={logistics?.label_requirements_note ?? ""}
              className={inputClass}
            />
          </Field>
          <Field
            label="What goes wrong at this show"
            htmlFor="dts_public_notes"
            hint="The only part of the page a competitor cannot copy. Written by us, from the debriefs — never the raw debrief text."
          >
            <textarea
              id="dts_public_notes"
              name="dts_public_notes"
              rows={4}
              defaultValue={logistics?.dts_public_notes ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <h4 className="font-heading text-sm font-semibold text-slate-900">
          Sources
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Source URL"
            htmlFor="source_url"
            required
            hint="Where you checked this. Shown on the page as the official source."
          >
            <input
              type="url"
              id="source_url"
              name="source_url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
              className={inputClass}
            />
          </Field>
          <Field label="Source type" htmlFor="source_type" required>
            <select
              id="source_type"
              name="source_type"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className={inputClass}
            >
              <option value="">Select…</option>
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="GSC exhibitor services URL"
            htmlFor="gsc_url"
            hint="Every page links the GSC, because material handling is billed by them and not by DTS."
            className="sm:col-span-2"
          >
            <input
              type="url"
              id="gsc_url"
              name="gsc_url"
              defaultValue={logistics?.gsc_url ?? ""}
              placeholder="https://"
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
        <button
          type="submit"
          formAction={verifyAction}
          disabled={!ready}
          title={
            ready
              ? "Records you and today's date against this source"
              : "Fix the items above first"
          }
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Icon name="check" className="h-4 w-4" />
          Verify
        </button>

        {state.ok ? (
          <span className="text-sm text-emerald-600">Saved.</span>
        ) : null}
        {state.error ? (
          <span className="text-sm text-dts-maroon">{state.error}</span>
        ) : null}
      </div>

      {verifyState.blockers?.length ? (
        <ul className="space-y-1 rounded-lg border border-dts-maroon/30 bg-dts-maroon/5 p-3 text-xs text-dts-maroon">
          {verifyState.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
