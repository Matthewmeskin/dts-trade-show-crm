import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { partnerToolsOn } from "@/lib/app-settings";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { dayOf, daysUntil, formatDate, formatPacificDateTime, formatShortDate, todayYMD } from "@/lib/format";
import { shiftDays } from "@/lib/sales";
import { SIGNAL_TYPES, labelOf, loopState, weekStart } from "@/lib/partners";
import { markSignalWorked } from "../actions";
import { manifestCadence, manifestDue, type CandidateShow } from "@/lib/gsc-manifest";
import { PartnersNav, StageBadge, TierBadge, WeeklyStrip, loadPeople, loadWeeklyNumbers } from "../parts";

export const dynamic = "force-dynamic";

/**
 * The sales admin's morning list, in the order to work it: calls whose rep
 * owes an outcome, then warm signals (newest first), then next steps due, then
 * the calls coming up. No signal, no call - there is deliberately no "cold
 * list" here.
 */
export default async function WorklistPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const { mine } = await searchParams;
  const supabase = await createClient();
  // Partner growth tooling: gone unless an admin has it on (lib/app-settings.ts).
  if (!(await partnerToolsOn(supabase))) notFound();
  const today = todayYMD();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub ?? "";
  const onlyMine = mine === "1" && !!me;

  const [people, week, { data: signals }, { data: steps }, { data: calls }, { data: links }, { data: reporting }, { data: gscShows }] = await Promise.all([
    loadPeople(supabase),
    loadWeeklyNumbers(supabase),
    supabase
      .from("partner_signals")
      .select("id, partner_id, signal_type, occurred_on, note, shows(show_name), partners!inner(name, tier, stage, admin_id, archived)")
      .is("worked_at", null)
      .eq("partners.archived", false)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("partners")
      .select("id, name, tier, stage, next_step, next_step_on, admin_id")
      .eq("archived", false)
      .lte("next_step_on", today)
      .not("stage", "in", "(not_fit)")
      .order("next_step_on")
      .limit(200),
    supabase
      .from("partner_calls")
      .select("id, partner_id, rep_id, scheduled_at, status, outcome, partners(name, admin_id)")
      .eq("status", "booked")
      .lte("scheduled_at", `${shiftDays(today, 8)}T12:00:00Z`)
      .order("scheduled_at")
      .limit(200),
    supabase.from("partner_shows").select("partner_id, client_count, shows(show_name, show_start_date)").limit(5000),
    supabase
      .from("partners")
      .select("id, name, tier, stage, admin_id, rep_id, report_to, last_report_sent_at")
      .eq("archived", false)
      .eq("report_active", true)
      .order("name"),
    // Shows serviced by GSCs whose reports are on: candidates for a manifest today.
    supabase
      .from("partner_shows")
      .select(
        "id, manifest_sent_at, partner_id, partners!inner(name, partner_type, report_active, archived, admin_id, rep_id), shows(id, show_name, show_start_date, show_end_date, move_in_start, move_in_end, move_out_start, move_out_end, advance_warehouse_open, advance_warehouse_cutoff, advance_warehouse_name, venue_id, advance_warehouse_zip, direct_to_show_zip)",
      )
      .eq("partners.partner_type", "gsc")
      .eq("partners.report_active", true)
      .eq("partners.archived", false)
      .limit(1000),
  ]);

  const names = new Map(people.map((p) => [p.id, p.name]));
  const nextShow = new Map<string, { name: string; start: string; clients: number | null }>();
  for (const l of links ?? []) {
    const s = l.shows;
    if (!s?.show_start_date || s.show_start_date < today) continue;
    const cur = nextShow.get(l.partner_id);
    if (!cur || s.show_start_date < cur.start) nextShow.set(l.partner_id, { name: s.show_name, start: s.show_start_date, clients: l.client_count });
  }

  const mineOnly = <T,>(rows: T[], adminOf: (r: T) => string | null | undefined) =>
    onlyMine ? rows.filter((r) => adminOf(r) === me) : rows;
  const now = new Date();
  const owed = mineOnly(calls ?? [], (c) => c.partners?.admin_id).filter((c) => loopState(c, now) !== "upcoming");
  const upcoming = mineOnly(calls ?? [], (c) => c.partners?.admin_id).filter((c) => loopState(c, now) === "upcoming");
  const sigs = mineOnly(signals ?? [], (s) => s.partners.admin_id);
  const due = mineOnly(steps ?? [], (p) => p.admin_id);
  // Weekly pilot reports not yet sent since Monday. Reps send these, so "mine"
  // here means the rep or the admin on the partner.
  const manifestsDue = (gscShows ?? [])
    .filter((r) => r.shows)
    .map((r) => {
      const show = r.shows as unknown as CandidateShow;
      const cadence = manifestCadence(show, today);
      return { r, show, cadence, due: manifestDue(cadence, r.manifest_sent_at ? dayOf(r.manifest_sent_at) : null, today) };
    })
    .filter((x) => x.due)
    .filter((x) => !onlyMine || x.r.partners.admin_id === me || x.r.partners.rep_id === me);
  const monday = weekStart(today);
  const reportsDue = (reporting ?? [])
    .filter((p) => !p.last_report_sent_at || (dayOf(p.last_report_sent_at) ?? "") < monday)
    .filter((p) => !onlyMine || p.admin_id === me || p.rep_id === me);

  const NextShow = ({ partnerId }: { partnerId: string }) => {
    const ns = nextShow.get(partnerId);
    if (!ns) return <span className="text-xs text-amber-700">No upcoming show linked</span>;
    const d = daysUntil(ns.start);
    return (
      <span className="text-xs text-slate-500">
        Next: {ns.name} · {formatShortDate(ns.start)}
        {d != null ? ` (${d}d)` : ""}
        {ns.clients ? ` · ${ns.clients} clients` : ""}
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title="Partner worklist"
        description="Work it top to bottom: outcomes owed, client reports to send, new signals, next steps due, then the calls coming up."
        actions={
          <Link
            href={onlyMine ? "/partners/worklist" : "/partners/worklist?mine=1"}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {onlyMine ? "Show everyone's" : "Only partners I own"}
          </Link>
        }
      />
      <PartnersNav active="worklist" />
      <WeeklyStrip n={week} />

      <div className="space-y-5">
        {owed.length ? (
          <Card className="border-dts-maroon/30">
            <CardHeader title={`Outcomes owed (${owed.length})`} icon="alert" />
            <ul className="divide-y divide-slate-100">
              {owed.map((c) => {
                const late = loopState(c, now) === "overdue";
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <Link href={`/partners/${c.partner_id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                        {c.partners?.name}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {formatPacificDateTime(c.scheduled_at)} · {names.get(c.rep_id) ?? "—"}
                      </div>
                    </div>
                    <Badge className={late ? "bg-dts-maroon/10 text-dts-maroon" : "bg-amber-100 text-amber-800"}>
                      {late ? "Over 24 hours — close the loop" : "Due today"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {manifestsDue.length ? (
          <Card>
            <CardHeader title={`GSC manifests to send (${manifestsDue.length})`} icon="truck" />
            <ul className="divide-y divide-slate-100">
              {manifestsDue.map(({ r, show, cadence }) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/partners/${r.partner_id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                      {r.partners.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {show.show_name} ·{" "}
                      {cadence === "outbound" ? "outbound list, daily through teardown" : cadence === "daily" ? "inbound, daily — move-in is this week" : "inbound, weekly"}
                    </div>
                  </div>
                  <Link
                    href={`/partners/${r.partner_id}/manifest?ps=${r.id}`}
                    className="rounded-lg bg-dts-maroon px-3 py-1.5 text-xs font-medium text-white hover:bg-dts-maroon-dark"
                  >
                    Check and send
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {reportsDue.length ? (
          <Card>
            <CardHeader title={`Weekly client reports to send (${reportsDue.length})`} icon="documents" />
            <ul className="divide-y divide-slate-100">
              {reportsDue.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/partners/${p.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                        {p.name}
                      </Link>
                      <StageBadge stage={p.stage} />
                    </div>
                    <div className="text-xs text-slate-500">
                      To {p.report_to ?? "—"} · rep {p.rep_id ? (names.get(p.rep_id) ?? "—") : "—"}
                      {p.last_report_sent_at ? ` · last sent ${formatShortDate(dayOf(p.last_report_sent_at))}` : " · never sent"}
                    </div>
                  </div>
                  <Link
                    href={`/partners/${p.id}/report`}
                    className="rounded-lg bg-dts-maroon px-3 py-1.5 text-xs font-medium text-white hover:bg-dts-maroon-dark"
                  >
                    Check and send
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <CardHeader title={`New signals (${sigs.length})`} icon="bell" />
          {sigs.length ? (
            <ul className="divide-y divide-slate-100">
              {sigs.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/partners/${s.partner_id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                        {s.partners.name}
                      </Link>
                      <TierBadge tier={s.partners.tier} />
                      <StageBadge stage={s.partners.stage} />
                    </div>
                    <div className="text-slate-700">
                      {labelOf(SIGNAL_TYPES, s.signal_type)}
                      {s.shows?.show_name ? ` · ${s.shows.show_name}` : ""}
                      {s.note ? <span className="text-slate-500"> — {s.note}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-x-3">
                      <span className="text-xs text-slate-400">
                        {s.occurred_on === today ? "Today" : formatShortDate(s.occurred_on)}
                      </span>
                      <NextShow partnerId={s.partner_id} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/partners/${s.partner_id}`}
                      className="rounded-lg bg-dts-maroon px-3 py-1.5 text-xs font-medium text-white hover:bg-dts-maroon-dark"
                    >
                      Work it
                    </Link>
                    <form action={markSignalWorked}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="partner_id" value={s.partner_id} />
                      <button type="submit" className="text-xs font-medium text-slate-400 hover:text-slate-700">
                        Dismiss
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="bell"
              title="No new signals"
              description="Add them from a partner page as they come in: show page visits, quote requests, replies, events, referrals."
            />
          )}
        </Card>

        <Card>
          <CardHeader title={`Next steps due (${due.length})`} icon="tasks" />
          {due.length ? (
            <ul className="divide-y divide-slate-100">
              {due.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/partners/${p.id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                        {p.name}
                      </Link>
                      <TierBadge tier={p.tier} />
                      <StageBadge stage={p.stage} />
                    </div>
                    <div className="text-slate-700">{p.next_step ?? "Follow up"}</div>
                    <NextShow partnerId={p.id} />
                  </div>
                  <span className={`text-xs ${p.next_step_on! < today ? "font-medium text-dts-maroon" : "text-slate-500"}`}>
                    {p.next_step_on === today ? "Today" : `Overdue · ${formatDate(p.next_step_on)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="tasks" title="Nothing due" description="Next steps set on a partner show up here on their date." />
          )}
        </Card>

        <Card>
          <CardHeader title={`Calls this week (${upcoming.length})`} icon="calendar" />
          {upcoming.length ? (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/partners/${c.partner_id}`} className="font-medium text-slate-900 hover:text-dts-maroon">
                    {c.partners?.name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {formatPacificDateTime(c.scheduled_at)} · {names.get(c.rep_id) ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="calendar" title="No calls in the next week" />
          )}
        </Card>
      </div>
    </div>
  );
}
