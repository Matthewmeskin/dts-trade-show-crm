import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { dayOf, formatDate, formatDateRange, formatPacificDateTime, formatShortDate, todayYMD } from "@/lib/format";
import {
  CALL_STATUSES,
  CHANNELS,
  OUTCOMES,
  PARTNER_ASK,
  PARTNER_TYPES,
  SIGNAL_TYPES,
  STAGES,
  labelOf,
  loopState,
  metaOf,
  cobrandUrl,
  suggestQualification,
  weekStart,
  type PartnerType,
} from "@/lib/partners";
import {
  archivePartner,
  markSignalWorked,
  removePartnerClient,
  removePartnerShow,
  setClientPilot,
  setPartnerStatus,
  setShowCobranded,
  setShowPilot,
} from "../actions";
import { loadPartnerReport } from "../report-data";
import { loadManifestOptions } from "../manifest-data";
import { loadCreditSummary } from "../rebate-data";
import { CreditSuggestionsForm } from "./rebates/rebate-forms";
import { AddClientForm, ReportSettingsForm } from "./client-panels";
import { CobrandForm, CopyLink, TermsForm } from "./cobrand-panels";
import { StageBadge, TierBadge, loadPeople } from "../parts";
import { AddContactForm, AddShowForm, BookCallForm, CloseCallForm, SignalForm, TouchForm } from "./panels";
import { DraftTouch } from "./draft-touch";

export const dynamic = "force-dynamic";

const fullName = (c: { first_name: string | null; last_name: string | null }) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayYMD();

  const { data: partner } = await supabase.from("partners").select("*").eq("id", id).maybeSingle();
  if (!partner) notFound();

  const [
    people,
    { data: links },
    { data: contacts },
    { data: signals },
    { data: touches },
    { data: calls },
    { data: allShows },
    { data: clients },
    reportData,
    credit,
  ] = await Promise.all([
      loadPeople(supabase),
      supabase
        .from("partner_shows")
        .select("id, show_id, client_count, notes, is_pilot, cobranded, shows(show_name, show_start_date, show_end_date, series_id)")
        .eq("partner_id", id),
      supabase.from("contacts").select("id, first_name, last_name, title, email, phone").eq("partner_id", id).order("created_at"),
      supabase
        .from("partner_signals")
        .select("id, signal_type, occurred_on, note, worked_at, show_id, shows(show_name)")
        .eq("partner_id", id)
        .order("occurred_on", { ascending: false })
        .limit(50),
      supabase
        .from("partner_touches")
        .select("id, channel, reached, note, occurred_at, created_by")
        .eq("partner_id", id)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase.from("partner_calls").select("*").eq("partner_id", id).order("scheduled_at", { ascending: false }),
      supabase
        .from("shows")
        .select("id, show_name, show_start_date")
        .eq("archived", false)
        .gte("show_start_date", today)
        .order("show_start_date")
        .limit(1000),
      supabase
        .from("partner_clients")
        .select("id, exhibitor_id, in_pilot, exhibitors(company_name)")
        .eq("partner_id", id),
      loadPartnerReport(supabase, id),
      loadCreditSummary(supabase, id),
    ]);
  const clientList = (clients ?? []).sort(
    (a, b) => Number(b.in_pilot) - Number(a.in_pilot) || (a.exhibitors?.company_name ?? "").localeCompare(b.exhibitors?.company_name ?? ""),
  );
  const report = reportData?.report;
  const manifestOptions = partner.partner_type === "gsc" ? await loadManifestOptions(supabase, id) : [];

  // Which linked shows have a public page, so the cobranded links can say
  // whether they'll actually land on this partner's branding yet.
  const seriesIds = [...new Set((links ?? []).map((l) => l.shows?.series_id).filter((x): x is string => !!x))];
  const { data: seriesRows } = seriesIds.length
    ? await supabase.from("show_series").select("id, slug, is_public").in("id", seriesIds)
    : { data: [] as { id: string; slug: string; is_public: boolean }[] };
  const seriesBy = new Map((seriesRows ?? []).map((x) => [x.id, x]));
  const reportSentThisWeek = !!partner.last_report_sent_at && (dayOf(partner.last_report_sent_at) ?? "") >= weekStart(today);

  const names = new Map(people.map((p) => [p.id, p.name]));
  const linked = (links ?? [])
    .filter((l) => l.shows)
    .sort((a, b) => (a.shows!.show_start_date ?? "9999").localeCompare(b.shows!.show_start_date ?? "9999"));
  const upcomingLinked = linked.filter((l) => l.shows!.show_start_date && l.shows!.show_start_date >= today);
  const linkedIds = new Set(linked.map((l) => l.show_id));
  const showOptions = (allShows ?? []).map((s) => ({
    id: s.id,
    label: `${s.show_name} — ${formatShortDate(s.show_start_date)}`,
  }));
  const addableShows = showOptions.filter((s) => !linkedIds.has(s.id));

  const openSignals = (signals ?? []).filter((s) => !s.worked_at);
  const suggestion = suggestQualification(
    partner,
    linked.map((l) => ({ name: l.shows!.show_name, start: l.shows!.show_start_date })),
    today,
  );
  const latestSignal = openSignals[0] ?? (signals ?? [])[0];
  const showsNote = upcomingLinked
    .slice(0, 3)
    .map((l) => `${l.shows!.show_name} (${formatShortDate(l.shows!.show_start_date)})${l.client_count ? ` — ${l.client_count} clients` : ""}`)
    .join("; ");
  const firstEmail = (contacts ?? []).find((c) => c.email)?.email ?? null;
  const now = new Date();

  return (
    <div>
      <PageHeader
        title={partner.name}
        breadcrumbs={[{ label: "Partners", href: "/partners" }]}
        actions={
          <>
            <Link
              href={`/partners/${id}/edit`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Edit
            </Link>
            <form action={archivePartner}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="archived" value={partner.archived ? "false" : "true"} />
              <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-700">
                {partner.archived ? "Restore" : "Archive"}
              </button>
            </form>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <TierBadge tier={partner.tier} />
        <StageBadge stage={partner.stage} />
        <Badge className="bg-slate-100 text-slate-600">{labelOf(PARTNER_TYPES, partner.partner_type)}</Badge>
        {partner.city || partner.state ? <span>{[partner.city, partner.state].filter(Boolean).join(", ")}</span> : null}
        {partner.website ? (
          <a href={partner.website} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
            {partner.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗
          </a>
        ) : null}
        {partner.archived ? <Badge className="bg-slate-200 text-slate-600">Archived</Badge> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Where it stands" icon="tasks" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">What we ask for</dt>
                  <dd className="text-slate-800">{PARTNER_ASK[partner.partner_type as PartnerType]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Exhibitor clients</dt>
                  <dd className="text-slate-800">{partner.client_count ?? "Unknown — ask on the first conversation"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Sales admin / rep</dt>
                  <dd className="text-slate-800">
                    {partner.admin_id ? names.get(partner.admin_id) : "—"} / {partner.rep_id ? names.get(partner.rep_id) : "—"}
                  </dd>
                </div>
                {partner.shipping_pain ? (
                  <div>
                    <dt className="text-xs text-slate-400">Shipping pain</dt>
                    <dd className="whitespace-pre-line text-slate-800">{partner.shipping_pain}</dd>
                  </div>
                ) : null}
                {partner.notes ? (
                  <div>
                    <dt className="text-xs text-slate-400">Notes</dt>
                    <dd className="whitespace-pre-line text-slate-800">{partner.notes}</dd>
                  </div>
                ) : null}
                {partner.source ? (
                  <div>
                    <dt className="text-xs text-slate-400">Source</dt>
                    <dd className="text-slate-800">{partner.source}</dd>
                  </div>
                ) : null}
              </dl>
              <form action={setPartnerStatus} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <input type="hidden" name="id" value={id} />
                <label className="block text-xs font-medium text-slate-500">
                  Status
                  <select
                    name="stage"
                    defaultValue={partner.stage}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-500">
                  Next step
                  <input
                    name="next_step"
                    defaultValue={partner.next_step ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-500">
                  By
                  <input
                    name="next_step_on"
                    type="date"
                    defaultValue={partner.next_step_on ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </label>
                {partner.next_step_on && partner.next_step_on < today ? (
                  <p className="text-xs font-medium text-dts-maroon">Overdue since {formatDate(partner.next_step_on)}</p>
                ) : null}
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Save
                </button>
              </form>
            </div>
          </Card>

          <Card>
            <CardHeader title="Calls" icon="calendar" />
            <div className="space-y-4 p-5">
              <BookCallForm
                partnerId={id}
                suggestion={suggestion}
                reps={people}
                defaultRepId={partner.rep_id}
                contacts={(contacts ?? []).map((c) => ({ id: c.id, name: `${fullName(c)}${c.title ? `, ${c.title}` : ""}` }))}
                defaults={{
                  signal: latestSignal
                    ? `${labelOf(SIGNAL_TYPES, latestSignal.signal_type)}${latestSignal.note ? ` — ${latestSignal.note}` : ""}`
                    : "",
                  showsNote,
                  clientCount: partner.client_count,
                  pain: partner.shipping_pain ?? "",
                }}
              />
              {(calls ?? []).length ? (
                <ul className="divide-y divide-slate-100">
                  {(calls ?? []).map((c) => {
                    const loop = loopState(c, now);
                    const outcome = metaOf(OUTCOMES, c.outcome);
                    return (
                      <li key={c.id} className="py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{formatPacificDateTime(c.scheduled_at)}</span>
                          <span className="text-slate-500">with {names.get(c.rep_id) ?? "—"}</span>
                          {c.status === "held" && outcome ? (
                            <Badge className={outcome.badge}>Held · {outcome.label}</Badge>
                          ) : c.status !== "booked" ? (
                            <Badge className="bg-slate-100 text-slate-500">{labelOf(CALL_STATUSES, c.status)}</Badge>
                          ) : loop === "overdue" ? (
                            <Badge className="bg-dts-maroon/10 text-dts-maroon">Outcome overdue</Badge>
                          ) : loop === "due" ? (
                            <Badge className="bg-amber-100 text-amber-800">Outcome due</Badge>
                          ) : (
                            <Badge className="bg-violet-100 text-violet-800">Booked</Badge>
                          )}
                        </div>
                        <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-[7rem_1fr]">
                          <dt className="text-slate-400">Signal</dt>
                          <dd>{c.signal}</dd>
                          <dt className="text-slate-400">Shows</dt>
                          <dd>{c.shows_note}</dd>
                          <dt className="text-slate-400">Clients</dt>
                          <dd>{c.client_count ?? "—"}</dd>
                          <dt className="text-slate-400">Shipping pain</dt>
                          <dd>{c.shipping_pain}</dd>
                          {c.outcome_note ? (
                            <>
                              <dt className="text-slate-400">Outcome note</dt>
                              <dd>{c.outcome_note}</dd>
                            </>
                          ) : null}
                          <dt className="text-slate-400">Booked by</dt>
                          <dd>{c.booked_by ? names.get(c.booked_by) : "—"}</dd>
                        </dl>
                        {loop === "due" || loop === "overdue" ? <CloseCallForm callId={c.id} partnerId={id} /> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No calls booked yet.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Shows they work" icon="shows" />
            <div className="space-y-3 p-5">
              {linked.length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {linked.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <Link href={`/shows/${l.show_id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                          {l.shows!.show_name}
                        </Link>
                        <div className="text-xs text-slate-400">
                          {formatDateRange(l.shows!.show_start_date, l.shows!.show_end_date)}
                          {l.client_count ? ` · ${l.client_count} clients` : ""}
                          {l.shows!.show_start_date && l.shows!.show_start_date < today ? " · past" : ""}
                        </div>
                      </div>
                      <form action={setShowPilot} className="ml-auto">
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="partner_id" value={id} />
                        <input type="hidden" name="is_pilot" value={l.is_pilot ? "false" : "true"} />
                        <button
                          type="submit"
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.is_pilot ? "bg-dts-maroon text-white" : "text-slate-400 hover:text-slate-700"}`}
                          title={l.is_pilot ? "Pilot show — click to unmark" : "Mark as the pilot show"}
                        >
                          {l.is_pilot ? "Pilot show" : "Make pilot show"}
                        </button>
                      </form>
                      <form action={removePartnerShow}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="partner_id" value={id} />
                        <button type="submit" className="text-xs text-slate-400 hover:text-dts-maroon">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No shows linked. The first touch and the qualification check both need one.</p>
              )}
              <AddShowForm partnerId={id} shows={addableShows} />
            </div>
          </Card>

          <Card>
            <CardHeader title={`Clients (${clientList.length})`} icon="exhibitors" />
            <div className="space-y-3 p-5">
              <p className="text-xs text-slate-500">
                The exhibitors whose freight this partner controls. Their shipments feed the weekly report. Land and
                expand: mark the few in the pilot, then add the rest of the book as they come over.
              </p>
              {clientList.length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {clientList.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/exhibitors/${c.exhibitor_id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                        {c.exhibitors?.company_name ?? "—"}
                      </Link>
                      <div className="flex items-center gap-3">
                        <form action={setClientPilot}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="partner_id" value={id} />
                          <input type="hidden" name="in_pilot" value={c.in_pilot ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.in_pilot ? "bg-dts-maroon text-white" : "text-slate-400 hover:text-slate-700"}`}
                          >
                            {c.in_pilot ? "Pilot" : "Add to pilot"}
                          </button>
                        </form>
                        <form action={removePartnerClient}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="partner_id" value={id} />
                          <button type="submit" className="text-xs text-slate-400 hover:text-dts-maroon">
                            Remove
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <AddClientForm partnerId={id} />
            </div>
          </Card>

          <Card>
            <CardHeader title="People" icon="contacts" />
            <div className="space-y-3 p-5">
              {(contacts ?? []).length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {(contacts ?? []).map((c) => (
                    <li key={c.id} className="py-2">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                        {fullName(c)}
                      </Link>
                      {c.title ? <span className="text-slate-500"> · {c.title}</span> : null}
                      <div className="text-xs text-slate-500">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Nobody on file. Find who makes the shipping call for their clients.</p>
              )}
              <AddContactForm partnerId={id} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {partner.partner_type === "gsc" ? (
            <Card>
              <CardHeader
                title="GSC manifest"
                icon="truck"
                action={
                  <Link href={`/partners/${id}/manifest`} className="text-xs font-medium text-dts-maroon hover:underline">
                    Open →
                  </Link>
                }
              />
              <div className="space-y-2 p-5 text-xs text-slate-600">
                <p>
                  Every DTS load to the shows they service: the inbound manifest weekly, daily the last week before move-in,
                  then the outbound list through teardown.
                </p>
                {manifestOptions.length ? (
                  <ul className="space-y-1">
                    {manifestOptions.map((o) => (
                      <li key={o.partnerShowId} className="flex items-center justify-between gap-2">
                        <Link href={`/partners/${id}/manifest?ps=${o.partnerShowId}`} className="text-slate-800 hover:text-dts-maroon">
                          {o.show.show_name}
                        </Link>
                        <span className={o.due ? "font-semibold text-dts-maroon" : "text-slate-400"}>
                          {o.due ? "Due now" : o.cadence === "none" ? "Not yet" : "Sent"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">Link the shows they service below.</p>
                )}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Weekly client report"
              icon="documents"
              action={
                <Link href={`/partners/${id}/report`} className="text-xs font-medium text-dts-maroon hover:underline">
                  Open this week&apos;s →
                </Link>
              }
            />
            <div className="space-y-3 p-5">
              {report && clientList.length ? (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className={`rounded-lg border px-2 py-1.5 ${report.counts.outboundGaps ? "border-dts-maroon/30 bg-dts-maroon/5" : "border-slate-200"}`}>
                    <div className={`text-lg font-semibold ${report.counts.outboundGaps ? "text-dts-maroon" : "text-slate-900"}`}>
                      {report.counts.outboundGaps}
                    </div>
                    <div className="text-xs text-slate-500">Outbound not booked</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-2 py-1.5">
                    <div className="text-lg font-semibold text-slate-900">{report.counts.inMotion + report.counts.outboundBooked}</div>
                    <div className="text-xs text-slate-500">Moving now</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Link their clients below and their freight shows up here.</p>
              )}
              <ReportSettingsForm partnerId={id} reportTo={partner.report_to} active={partner.report_active} />
              <p className="text-xs text-slate-400">
                {partner.last_report_sent_at
                  ? `${reportSentThisWeek ? "Sent this week" : "Last sent"} ${formatPacificDateTime(partner.last_report_sent_at)}.`
                  : "Never sent."}{" "}
                The CRM writes it; you check it and send it.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cobranded show pages" icon="external" />
            <div className="space-y-4 p-5">
              <p className="text-xs text-slate-500">
                For GSCs, organizers and builders who put our show page in their exhibitor kit: the same verified page with
                their name and logo, and their code on the quote button so every quote from it is credited to them.
              </p>
              <CobrandForm
                partnerId={id}
                name={partner.name}
                code={partner.code}
                publicName={partner.public_name}
                logoUrl={partner.logo_url}
                active={partner.cobrand_active}
              />
              {linked.length ? (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
                  {linked.map((l) => {
                    const ser = l.shows?.series_id ? seriesBy.get(l.shows.series_id) : undefined;
                    const live = !!(partner.cobrand_active && partner.code && l.cobranded && ser?.is_public);
                    return (
                      <li key={l.id} className="space-y-1 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800">{l.shows!.show_name}</span>
                          <form action={setShowCobranded}>
                            <input type="hidden" name="id" value={l.id} />
                            <input type="hidden" name="partner_id" value={id} />
                            <input type="hidden" name="cobranded" value={l.cobranded ? "false" : "true"} />
                            <button
                              type="submit"
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.cobranded ? "bg-sky-700 text-white" : "text-slate-400 hover:text-slate-700"}`}
                            >
                              {l.cobranded ? "Cobranded" : "Cobrand this show"}
                            </button>
                          </form>
                        </div>
                        {l.cobranded ? (
                          <div className="text-xs text-slate-500">
                            {!ser ? (
                              "This show isn't attached to a public show page yet (Show page tab)."
                            ) : !ser.is_public ? (
                              "Its show page isn't published yet — the link starts working once it's verified and published."
                            ) : !partner.code ? (
                              "Set a code above to get the link."
                            ) : (
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="break-all">{cobrandUrl(ser.slug, partner.code)}</span>
                                <CopyLink url={cobrandUrl(ser.slug, partner.code)} />
                                {!live ? <span className="text-amber-700">Turn cobranding on to go live.</span> : null}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Link the shows they service under Shows first.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Terms" icon="documents" />
            <div className="p-5">
              <TermsForm
                partnerId={id}
                model={partner.incentive_model}
                rebatePct={partner.rebate_pct}
                markupPct={partner.markup_pct}
                basis={partner.commission_basis}
                note={partner.terms_note}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Credit and rebates"
              icon="reports"
              action={
                <Link href={`/partners/${id}/rebates`} className="text-xs font-medium text-dts-maroon hover:underline">
                  Rebate statements →
                </Link>
              }
            />
            <div className="space-y-3 p-5 text-sm">
              <p className="text-slate-600">
                {credit.creditedCount} load{credit.creditedCount === 1 ? "" : "s"} credited to them.
                {partner.incentive_model === "rebate" && partner.rebate_pct
                  ? ` They earn ${partner.rebate_pct}% of gross margin once each invoice is paid.`
                  : " No rebate terms set yet."}
              </p>
              {credit.suggestions.length ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Booked by their clients since each client was linked, and not credited to anyone. Untick any that
                    didn&apos;t come through them.
                  </p>
                  <CreditSuggestionsForm
                    partnerId={id}
                    rows={credit.suggestions.slice(0, 50).map((x) => ({
                      id: x.id,
                      label: `${x.tms_reference_id ?? "No load #"} · ${x.client}`,
                      detail: [x.show_name, `booked ${formatShortDate(x.booked_on)}`, x.status].filter(Boolean).join(" · "),
                    }))}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Nothing to credit from their clients. Loads that came in on their partner code are credited from the
                  shipment page (the office email names the code).
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="First touch" icon="sparkles" />
            <div className="p-5">
              <DraftTouch
                partnerId={id}
                shows={upcomingLinked.map((l) => ({
                  id: l.show_id,
                  label: `${l.shows!.show_name} — ${formatShortDate(l.shows!.show_start_date)}`,
                }))}
                email={firstEmail}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Log a touch" icon="enter" />
            <div className="p-5">
              <TouchForm
                partnerId={id}
                openSignals={openSignals.map((s) => ({
                  id: s.id,
                  label: `${labelOf(SIGNAL_TYPES, s.signal_type)} (${formatShortDate(s.occurred_on)})`,
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Signals" icon="bell" />
            <div className="space-y-4 p-5">
              <SignalForm partnerId={id} shows={showOptions} />
              {(signals ?? []).length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {(signals ?? []).map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-2 py-2">
                      <div className={s.worked_at ? "text-slate-400" : ""}>
                        <div className="font-medium">{labelOf(SIGNAL_TYPES, s.signal_type)}</div>
                        <div className="text-xs">
                          {formatShortDate(s.occurred_on)}
                          {s.shows?.show_name ? ` · ${s.shows.show_name}` : ""}
                          {s.note ? ` · ${s.note}` : ""}
                        </div>
                      </div>
                      <form action={markSignalWorked}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="partner_id" value={id} />
                        {s.worked_at ? <input type="hidden" name="undo" value="true" /> : null}
                        <button type="submit" className="whitespace-nowrap text-xs font-medium text-slate-400 hover:text-slate-700">
                          {s.worked_at ? "Reopen" : "Mark worked"}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Touches" icon="clock" />
            <div className="p-5">
              {(touches ?? []).length ? (
                <ul className="space-y-2.5 text-sm">
                  {(touches ?? []).map((t) => (
                    <li key={t.id}>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{labelOf(CHANNELS, t.channel)}</span>
                        {t.reached ? <Badge className="bg-emerald-50 text-emerald-700">Reached</Badge> : null}
                        <span>
                          {formatShortDate(dayOf(t.occurred_at))}
                          {t.created_by ? ` · ${names.get(t.created_by) ?? ""}` : ""}
                        </span>
                      </div>
                      {t.note ? <p className="whitespace-pre-line text-slate-700">{t.note}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No touches yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
