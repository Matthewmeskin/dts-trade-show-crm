"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/form";
import { Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { slugify, type Series } from "@/lib/logistics";
import {
  assignSeries,
  createSeries,
  rollToNextYear,
  setSeriesPublic,
  setVenueSlug,
  type LogisticsState,
} from "../logistics-actions";

const empty: LogisticsState = { error: null };

/**
 * Attaching a yearly row to the evergreen show, and publishing that show.
 *
 * These are separate acts on purpose. Attaching says "this is the 2027 edition of
 * IFT FIRST". Publishing says "IFT FIRST should have a page on dtsone.com at all".
 * The first is bookkeeping; the second is a decision about the website.
 */
export function SeriesPanel({
  showId,
  showName,
  editionYear,
  series,
  candidates,
  venue,
}: {
  showId: string;
  showName: string;
  editionYear: number | null;
  series: Series | null;
  candidates: { id: string; name: string; slug: string; is_public: boolean }[];
  venue: { id: string; venue_name: string; public_slug: string | null } | null;
}) {
  const [mode, setMode] = useState<"attach" | "create">(
    candidates.length ? "attach" : "create",
  );
  const [assignState, assignAction] = useActionState(assignSeries, empty);
  const [createState, createAction] = useActionState(createSeries, empty);
  const [venueState, venueAction] = useActionState(setVenueSlug, empty);
  const [rollState, rollAction] = useActionState(rollToNextYear, empty);
  const [slug, setSlug] = useState(slugify(showName));

  if (series) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">
                {series.name}
              </span>
              <Badge
                className={
                  series.is_public
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }
              >
                {series.is_public ? "Published" : "Not published"}
              </Badge>
            </div>
            <p className="mt-0.5 font-mono text-xs text-slate-400">
              /trade-show/shipping/{series.slug}
              {editionYear ? (
                <span className="ml-2 font-sans">
                  · this row is the {editionYear} edition
                </span>
              ) : null}
            </p>
          </div>

          <form action={setSeriesPublic}>
            <input type="hidden" name="show_id" value={showId} />
            <input type="hidden" name="series_id" value={series.id} />
            <input
              type="hidden"
              name="is_public"
              value={series.is_public ? "false" : "true"}
            />
            <button
              type="submit"
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                series.is_public
                  ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  : "bg-dts-maroon text-white hover:bg-dts-maroon-dark"
              }`}
            >
              <Icon name={series.is_public ? "close" : "external"} className="h-4 w-4" />
              {series.is_public ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-400">
          The URL never changes once this show has been published — the website
          refuses to rename a slug that has ever been live, because a ranked page is
          the whole point of the exercise.
        </p>

        <form action={rollAction} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="show_id" value={showId} />
          <SubmitButton pendingLabel="Creating…">
            Roll to {editionYear ? editionYear + 1 : "next year"}
          </SubmitButton>
          <span className="text-xs text-slate-400">
            Creates next year&apos;s edition as a draft under this same page. Name,
            venue and organizer carry over; dates and addresses start empty, with this
            year&apos;s shown for reference.
          </span>
          {rollState.error ? (
            <p className="basis-full text-xs text-dts-maroon">{rollState.error}</p>
          ) : null}
        </form>

        {venue && !venue.public_slug ? (
          <form action={venueAction} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <input type="hidden" name="show_id" value={showId} />
            <input type="hidden" name="venue_id" value={venue.id} />
            <p className="text-xs text-amber-800">
              <strong>{venue.venue_name}</strong> has no URL slug yet, so this page
              cannot link to the venue&apos;s other shows.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Venue slug" htmlFor="venue_slug" className="flex-1">
                <input
                  id="venue_slug"
                  name="venue_slug"
                  defaultValue={slugify(venue.venue_name)}
                  className={inputClass}
                />
              </Field>
              <SubmitButton pendingLabel="Saving…">Save venue slug</SubmitButton>
            </div>
            {venueState.error ? (
              <p className="text-xs text-dts-maroon">{venueState.error}</p>
            ) : null}
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        This row is one year of a show. Before it can have a page, tell us which
        show it is a year of.
      </p>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("attach")}
          disabled={!candidates.length}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition disabled:text-slate-400 ${
            mode === "attach" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Attach to an existing show
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
            mode === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          This is a new show
        </button>
      </div>

      {mode === "attach" ? (
        <form action={assignAction} className="space-y-3">
          <input type="hidden" name="show_id" value={showId} />
          <Field label="Show" htmlFor="series_id">
            <select id="series_id" name="series_id" className={inputClass}>
              <option value="">Select…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (/{c.slug}){c.is_public ? "" : " — not published"}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton pendingLabel="Attaching…">Attach this year</SubmitButton>
          {assignState.error ? (
            <p className="text-sm text-dts-maroon">{assignState.error}</p>
          ) : null}
        </form>
      ) : (
        <form action={createAction} className="space-y-4">
          <input type="hidden" name="show_id" value={showId} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Show name"
              htmlFor="series_name"
              required
              hint="Without the year — this is the show, not one edition of it."
            >
              <input
                id="series_name"
                name="series_name"
                defaultValue={showName}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field
              label="URL slug"
              htmlFor="series_slug"
              required
              hint="Permanent. Check it now — it cannot be changed once the page is live."
            >
              <input
                id="series_slug"
                name="series_slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field
              label="One-line description"
              htmlFor="description_short"
              hint="Written by us, never copied from the organizer."
              className="sm:col-span-2"
            >
              <input
                id="description_short"
                name="description_short"
                className={inputClass}
              />
            </Field>
            <Field label="Industry" htmlFor="industry">
              <input id="industry" name="industry" className={inputClass} />
            </Field>
            <Field label="Usual city" htmlFor="typical_city">
              <input id="typical_city" name="typical_city" className={inputClass} />
            </Field>
          </div>
          <p className="font-mono text-xs text-slate-400">
            /trade-show/shipping/{slug || "…"}
          </p>
          <SubmitButton pendingLabel="Creating…">
            Create show and attach this year
          </SubmitButton>
          {createState.error ? (
            <p className="text-sm text-dts-maroon">{createState.error}</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
