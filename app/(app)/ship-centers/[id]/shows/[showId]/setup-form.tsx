"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui";
import { Field, FormSection, inputClass } from "@/components/form";
import { KitFillBar } from "../../../../shows/kit-fill-bar";
import type { Tables } from "@/lib/database.types";
import { SOURCE_TYPES, TIMEZONES, slugify } from "@/lib/logistics";
import { evergreenName } from "@/lib/ship-center";
import { saveShipSetup, type ShipState } from "../../../actions";

type Prefix = "advance_warehouse" | "direct_to_show";

/** Address fields named for the show columns, labelled for what they are here. */
function Address({ prefix, show, nameLabel }: { prefix: Prefix; show: Tables<"shows">; nameLabel: string }) {
  const f = (k: string) => `${prefix}_${k}`;
  const v = (k: string) => (show[f(k) as keyof Tables<"shows">] as string | null) ?? "";
  return (
    <>
      <Field label={nameLabel} htmlFor={f("name")} className="sm:col-span-2">
        <input id={f("name")} name={f("name")} defaultValue={v("name")} className={inputClass} />
      </Field>
      <Field label="C/O" htmlFor={f("care_of")} hint="If the kit ships in care of someone." className="sm:col-span-2">
        <input id={f("care_of")} name={f("care_of")} defaultValue={v("care_of")} className={inputClass} />
      </Field>
      <Field label="Street" htmlFor={f("street1")} className="sm:col-span-2">
        <input id={f("street1")} name={f("street1")} defaultValue={v("street1")} className={inputClass} />
      </Field>
      <Field label="Suite, dock or line 2" htmlFor={f("street2")} className="sm:col-span-2">
        <input id={f("street2")} name={f("street2")} defaultValue={v("street2")} className={inputClass} />
      </Field>
      <Field label="City" htmlFor={f("city")}>
        <input id={f("city")} name={f("city")} defaultValue={v("city")} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="State" htmlFor={f("state")}>
          <input id={f("state")} name={f("state")} defaultValue={v("state")} className={inputClass} />
        </Field>
        <Field label="ZIP" htmlFor={f("zip")}>
          <input id={f("zip")} name={f("zip")} defaultValue={v("zip")} className={inputClass} />
        </Field>
      </div>
      <input type="hidden" name={f("country")} value={v("country")} />
      <input type="hidden" name={`${prefix}_address_legacy`} value={v("address")} />
    </>
  );
}

function DateInput({ name, label, show, error }: { name: keyof Tables<"shows">; label: string; show: Tables<"shows">; error?: string }) {
  return (
    <Field label={label} htmlFor={name} error={error}>
      <input id={name} name={name} type="date" defaultValue={(show[name] as string | null) ?? ""} className={inputClass} />
    </Field>
  );
}

function Buttons({ isAdmin, enabled }: { isAdmin: boolean; enabled: boolean }) {
  const { pending, data } = useFormStatus();
  const mode = data?.get("mode");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        name="mode"
        value="verify"
        disabled={pending}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending && mode === "verify" ? "Verifying…" : isAdmin && !enabled ? "Verify and turn on" : "Verify"}
      </button>
      <button
        type="submit"
        name="mode"
        value="save"
        disabled={pending}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending && mode === "save" ? "Saving…" : "Save for later"}
      </button>
    </div>
  );
}

export function SetupForm({
  partnerId,
  showId,
  isAdmin,
  enabled,
  webAddress,
  code,
  show,
  logistics,
  coordinator,
  venues,
}: {
  partnerId: string;
  showId: string;
  isAdmin: boolean;
  enabled: boolean;
  webAddress: string | null;
  code: string | null;
  show: Tables<"shows">;
  logistics: Tables<"show_public_logistics"> | null;
  coordinator: { name: string | null; mobile: string | null; manifestEmail: string; outboundEmail: boolean };
  venues: { id: string; venue_name: string; label: string }[];
}) {
  const [state, action] = useActionState(saveShipSetup, { error: null } as ShipState);
  const formRef = useRef<HTMLFormElement>(null);
  const [slug, setSlug] = useState(slugify(evergreenName(show.show_name)));
  const err = state.fieldErrors ?? {};
  const l = logistics;

  return (
    <div className="space-y-5">
      <KitFillBar showId={showId} formRef={formRef} defaultUrl={show.exhibitor_manual_url} venues={venues} />

      <Card>
        <form ref={formRef} action={action}>
          <input type="hidden" name="partner_id" value={partnerId} />
          <input type="hidden" name="show_id" value={showId} />

          <FormSection title="The show">
            <Field label="Show name" htmlFor="show_name" required error={err.show_name} className="sm:col-span-2">
              <input id="show_name" name="show_name" defaultValue={show.show_name} className={inputClass} />
            </Field>
            <DateInput name="show_start_date" label="Opens" show={show} />
            <DateInput name="show_end_date" label="Closes" show={show} error={err.show_end_date} />
            <Field label="Timezone" htmlFor="timezone" hint="The show city's.">
              <select id="timezone" name="timezone" defaultValue={l?.timezone ?? ""} className={inputClass}>
                <option value="">Choose…</option>
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Venue" htmlFor="venue_id">
              <select id="venue_id" name="venue_id" defaultValue={show.venue_id ?? ""} className={inputClass}>
                <option value="">Not set</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Exhibitor kit link" htmlFor="exhibitor_manual_url" error={err.exhibitor_manual_url} className="sm:col-span-2">
              <input id="exhibitor_manual_url" name="exhibitor_manual_url" defaultValue={show.exhibitor_manual_url ?? ""} className={inputClass} placeholder="https://" />
            </Field>
            {webAddress ? (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-slate-700">Exhibitor page</p>
                <p className="mt-1 font-mono text-sm text-slate-500">{webAddress}</p>
              </div>
            ) : (
              <Field
                label="Short name for the web address"
                htmlFor="series_slug"
                error={err.series_slug}
                hint="Goes in the kit link and never changes, so check it. Same name every year."
                className="sm:col-span-2"
              >
                <input
                  id="series_slug"
                  name="series_slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className={`${inputClass} font-mono`}
                />
                <p className="mt-1 font-mono text-xs text-slate-400">
                  /ship/{code ?? "…"}/{slug || "…"}/{show.edition_year ?? show.show_start_date?.slice(0, 4) ?? "year"}
                </p>
                {state.slugTaken ? (
                  <label className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                    <input type="checkbox" name="use_existing_series" />
                    This is another year of {state.slugTaken.name}: use its web address.
                  </label>
                ) : null}
              </Field>
            )}
          </FormSection>

          <FormSection title="Advance warehouse" description="Where exhibitors ship before the show.">
            <Address prefix="advance_warehouse" show={show} nameLabel="Warehouse name" />
            <DateInput name="advance_warehouse_open" label="Starts receiving" show={show} />
            <DateInput name="advance_warehouse_cutoff" label="Deadline" show={show} error={err.advance_warehouse_cutoff} />
            <Field label="Deadline time" htmlFor="advance_cutoff_local" hint="Local time at the warehouse.">
              <input id="advance_cutoff_local" name="advance_cutoff_local" type="time" defaultValue={l?.advance_cutoff_local?.slice(0, 5) ?? ""} className={inputClass} />
            </Field>
          </FormSection>

          <FormSection title="Direct to show site" description="Where exhibitors ship straight to the show.">
            <Address prefix="direct_to_show" show={show} nameLabel="Location name (hall, dock or venue)" />
            <DateInput name="direct_to_show_start" label="Starts receiving" show={show} />
            <DateInput name="direct_to_show_end" label="Last day" show={show} error={err.direct_to_show_end} />
            <Field label="Cut-off time" htmlFor="direct_cutoff_local">
              <input id="direct_cutoff_local" name="direct_cutoff_local" type="time" defaultValue={l?.direct_cutoff_local?.slice(0, 5) ?? ""} className={inputClass} />
            </Field>
          </FormSection>

          <FormSection title="Move in and move out">
            <DateInput name="move_in_start" label="Move-in starts" show={show} />
            <DateInput name="move_in_end" label="Move-in ends" show={show} error={err.move_in_end} />
            <DateInput name="move_out_start" label="Move-out starts" show={show} />
            <DateInput name="move_out_end" label="Move-out ends" show={show} error={err.move_out_end} />
          </FormSection>

          <FormSection title="For exhibitors">
            <Field label="Label rules from the kit" htmlFor="label_requirements_note" className="sm:col-span-2">
              <textarea
                id="label_requirements_note"
                name="label_requirements_note"
                rows={3}
                defaultValue={l?.label_requirements_note ?? ""}
                className={inputClass}
              />
            </Field>
            {isAdmin ? (
              <>
                <Field label="DTS coordinator for this show" htmlFor="coordinator_name">
                  <input id="coordinator_name" name="coordinator_name" defaultValue={coordinator.name ?? ""} className={inputClass} />
                </Field>
                <Field label="Coordinator mobile" htmlFor="coordinator_mobile">
                  <input id="coordinator_mobile" name="coordinator_mobile" defaultValue={coordinator.mobile ?? ""} className={inputClass} />
                </Field>
                <Field
                  label="Email the GSC its inbound manifest"
                  htmlFor="manifest_email"
                  hint="Weekly from 45 days out, daily the last week before move in, in the show's morning."
                >
                  <select id="manifest_email" name="manifest_email" defaultValue={coordinator.manifestEmail} className={inputClass}>
                    <option value="off">Off</option>
                    <option value="weekly_then_daily">On</option>
                  </select>
                </Field>
                <Field label="Email the GSC its outbound list" htmlFor="outbound_email" hint="Daily from the show opening through teardown.">
                  <select id="outbound_email" name="outbound_email" defaultValue={coordinator.outboundEmail ? "on" : "off"} className={inputClass}>
                    <option value="off">Off</option>
                    <option value="on">On</option>
                  </select>
                </Field>
              </>
            ) : null}
          </FormSection>

          <FormSection title="Checked against" description="Verifying records where you checked. Leave the link blank to use the kit link.">
            <Field label="Source link" htmlFor="source_url">
              <input id="source_url" name="source_url" defaultValue={l?.source_url ?? ""} className={inputClass} placeholder="The kit link" />
            </Field>
            <Field label="Source" htmlFor="source_type">
              <select id="source_type" name="source_type" defaultValue={l?.source_type ?? "official_kit"} className={inputClass}>
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </FormSection>

          <div className="space-y-3 border-t border-slate-100 px-5 py-4">
            <Buttons isAdmin={isAdmin} enabled={enabled} />
            {state.error ? <p className="text-sm text-dts-maroon">{state.error}</p> : null}
            {state.blockers?.length ? (
              <ul className="space-y-1 text-sm text-amber-800">
                {state.blockers.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            ) : null}
            {state.ok ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
