import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate, formatPacificDateTime, todayYMD } from "@/lib/format";
import {
  parseQuarter,
  previousQuarter,
  quarterName,
  quarterOf,
  recentQuarters,
  renderStatementHtml,
  renderStatementText,
  statementSubject,
} from "@/lib/rebates";
import { loadRebateDraft } from "../../rebate-data";
import { markRebateSent, voidRebateStatement } from "../../rebate-actions";
import { ReportActions } from "../report/report-actions";
import { IssueForm, MarkPaidForm } from "./rebate-forms";

export const dynamic = "force-dynamic";

const $ = (n: number | null | undefined) => formatCurrency(n, { cents: true });
const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400";
const td = "px-3 py-2 align-top";

/**
 * The quarterly rebate statement for one partner: the draft for a quarter
 * (paid, credited loads not on an earlier statement), what's still waiting on
 * payment, and the statements already issued - each with the partner-facing
 * email ready to copy.
 */
export default async function RebatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; s?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayYMD();

  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: partner }, { data: me }, { data: statements }] = await Promise.all([
    supabase.from("partners").select("name, public_name, rep_id, incentive_model, rebate_pct, report_to").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", claims?.claims?.sub ?? "").maybeSingle(),
    supabase
      .from("partner_rebate_statements")
      .select("*")
      .eq("partner_id", id)
      .order("period_end", { ascending: false }),
  ]);
  if (!partner) notFound();
  const isAdmin = me?.role === "admin";
  const issuedQuarters = new Set((statements ?? []).map((s) => s.quarter));

  const selected = sp.s ? (statements ?? []).find((s) => s.id === sp.s) : null;
  // Default: the last finished quarter, unless it's done; then the current one.
  const lastClosed = previousQuarter(quarterOf(today));
  const quarter = parseQuarter(sp.q) ?? (issuedQuarters.has(lastClosed.label) ? quarterOf(today) : lastClosed);
  const quarters = recentQuarters(today, 5);

  return (
    <div>
      <PageHeader
        title="Rebate statements"
        description={`${partner.name} · ${partner.incentive_model === "rebate" && partner.rebate_pct ? `${partner.rebate_pct}% of gross margin, paid quarterly on paid invoices` : "No rebate terms set"}`}
        breadcrumbs={[
          { label: "Partners", href: "/partners" },
          { label: partner.name, href: `/partners/${id}` },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {selected ? (
            <IssuedStatement
              partnerId={id}
              partnerName={partner.public_name || partner.name}
              repId={partner.rep_id}
              reportTo={partner.report_to}
              statement={selected}
              isAdmin={isAdmin}
              today={today}
            />
          ) : (
            <Draft partnerId={id} quarterLabel={quarter.label} isAdmin={isAdmin} quarters={quarters.map((q) => q.label)} issued={issuedQuarters} />
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Issued" icon="documents" />
            {statements?.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {statements.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/partners/${id}/rebates?s=${s.id}`}
                      className={`flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-slate-50 ${selected?.id === s.id ? "bg-slate-50" : ""}`}
                    >
                      <span>
                        <span className="font-medium text-slate-800">{quarterName(parseQuarter(s.quarter)!)}</span>
                        <span className="block text-xs text-slate-400">
                          {s.line_count} load{s.line_count === 1 ? "" : "s"} · {$(s.rebate_total)}
                        </span>
                      </span>
                      <StatusBadge status={s.status} sent={!!s.sent_at} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-slate-500">None yet.</p>
            )}
          </Card>
          <Card className="space-y-2 p-5 text-xs text-slate-500">
            <p>
              <strong className="text-slate-700">How a load gets on a statement:</strong> it&apos;s credited to this partner, its
              invoice is paid in full in Sage, and it hasn&apos;t been on an earlier statement.
            </p>
            <p>
              A load credited late is carried onto the next statement, not lost. A load can only ever be paid on once.
            </p>
            <p>Only an admin can issue a statement, mark one paid or void one.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, sent }: { status: string; sent: boolean }) {
  if (status === "paid") return <Badge className="bg-emerald-50 text-emerald-700">Paid</Badge>;
  if (sent) return <Badge className="bg-sky-50 text-sky-700">Sent</Badge>;
  return <Badge className="bg-amber-50 text-amber-800">Not sent</Badge>;
}

async function Draft({
  partnerId,
  quarterLabel,
  isAdmin,
  quarters,
  issued,
}: {
  partnerId: string;
  quarterLabel: string;
  isAdmin: boolean;
  quarters: string[];
  issued: Set<string>;
}) {
  const supabase = await createClient();
  const quarter = parseQuarter(quarterLabel)!;
  let loaded: Awaited<ReturnType<typeof loadRebateDraft>>;
  try {
    loaded = await loadRebateDraft(supabase, partnerId, quarter);
  } catch (e) {
    return (
      <Card className="p-5 text-sm text-dts-maroon">
        Couldn&apos;t read payment status from the AR ledger: {e instanceof Error ? e.message : String(e)}
      </Card>
    );
  }
  if (!loaded) return null;
  const { draft } = loaded;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {quarters.map((q) => (
          <Link
            key={q}
            href={`/partners/${partnerId}/rebates?q=${q}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${q === quarterLabel ? "border-dts-maroon bg-dts-maroon/5 font-medium text-dts-maroon" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {quarterName(parseQuarter(q)!)}
            {issued.has(q) ? " ✓" : ""}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={`${quarterName(quarter)} — draft`} icon="reports" />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Paid loads" value={String(draft.totals.loads)} />
            <Stat label="Gross margin" value={$(draft.totals.margin)} />
            <Stat label={`Rebate${draft.rebatePct ? ` at ${draft.rebatePct}%` : ""}`} value={$(draft.totals.rebate)} strong />
          </div>

          {draft.lines.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={th}>DTS #</th>
                    <th className={th}>Exhibitor / show</th>
                    <th className={th}>Paid</th>
                    <th className={`${th} text-right`}>Invoiced</th>
                    <th className={`${th} text-right`}>Cost</th>
                    <th className={`${th} text-right`}>Margin</th>
                    <th className={`${th} text-right`}>Rebate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {draft.lines.map((l) => (
                    <tr key={l.shipment_id}>
                      <td className={td}>
                        <Link href={`/shipments/${l.shipment_id}`} className="text-dts-blue hover:underline">
                          {l.tms_reference_id ?? "—"}
                        </Link>
                      </td>
                      <td className={td}>
                        <span className="text-slate-800">{l.exhibitor_name ?? "—"}</span>
                        <span className="block text-xs text-slate-400">{l.show_name ?? "No show"}</span>
                      </td>
                      <td className={td}>
                        {formatDate(l.paid_on)}
                        {l.carried ? <span className="block text-xs text-amber-700">Carried in</span> : null}
                      </td>
                      <td className={`${td} text-right`}>{$(l.billed)}</td>
                      <td className={`${td} text-right`}>{$(l.cost)}</td>
                      <td className={`${td} text-right`}>{$(l.margin)}</td>
                      <td className={`${td} text-right font-medium`}>{$(l.rebate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {draft.notes.length ? <Problems title="Worth a look before issuing" tone="slate" rows={draft.notes} /> : null}
          {draft.checks.length ? (
            <Problems title={`Held off the statement (${draft.checks.length})`} tone="amber" rows={draft.checks} />
          ) : null}
          {draft.paidAfter ? (
            <p className="text-xs text-slate-500">
              {draft.paidAfter} more load{draft.paidAfter === 1 ? " was" : "s were"} paid after {formatDate(quarter.end)} and will go
              on the next statement.
            </p>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            {draft.blockers.length ? (
              <ul className="space-y-1 text-sm text-slate-600">
                {draft.blockers.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            ) : isAdmin ? (
              <div className="space-y-1.5">
                <IssueForm
                  partnerId={partnerId}
                  quarter={quarter.label}
                  total={draft.totals.rebate}
                  label={`Issue ${quarterName(quarter)} statement — ${$(draft.totals.rebate)}`}
                />
                <p className="text-xs text-slate-400">
                  Issuing freezes these lines and the rebate %. The partner email is ready to copy right after.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Ready to issue. An admin issues it.</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={`Credited, waiting on payment (${draft.waiting.length})`} icon="clock" />
        {draft.waiting.length ? (
          <ul className="divide-y divide-slate-50 text-sm">
            {draft.waiting.map((w) => (
              <li key={w.shipment_id} className="flex items-start justify-between gap-3 px-5 py-2">
                <span>
                  <Link href={`/shipments/${w.shipment_id}`} className="text-dts-blue hover:underline">
                    {w.tms_reference_id ?? "No load #"}
                  </Link>{" "}
                  <span className="text-slate-800">{w.exhibitor_name ?? "—"}</span>
                  <span className="block text-xs text-slate-400">{w.why}</span>
                </span>
                {w.owed != null ? <span className="whitespace-nowrap text-xs text-slate-500">{$(w.owed)} owed</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-slate-500">
            Nothing waiting. Credit loads from the{" "}
            <Link href={`/partners/${partnerId}`} className="text-dts-maroon hover:underline">
              partner page
            </Link>{" "}
            or from a shipment.
          </p>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 px-2 py-2">
      <div className={`text-lg font-semibold ${strong ? "text-dts-maroon" : "text-slate-900"}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function Problems({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "amber" | "slate";
  rows: { shipment_id: string; tms_reference_id: string | null; exhibitor_name: string | null; problem: string }[];
}) {
  return (
    <div className={`rounded-lg border p-3 text-xs ${tone === "amber" ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-slate-50"}`}>
      <div className={`mb-1.5 text-sm font-medium ${tone === "amber" ? "text-amber-800" : "text-slate-700"}`}>{title}</div>
      <ul className="space-y-1 text-slate-600">
        {rows.map((r) => (
          <li key={r.shipment_id}>
            <Link href={`/shipments/${r.shipment_id}`} className="text-dts-blue hover:underline">
              {r.tms_reference_id ?? "No load #"}
            </Link>{" "}
            {r.exhibitor_name ?? ""} — {r.problem}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function IssuedStatement({
  partnerId,
  partnerName,
  repId,
  reportTo,
  statement: st,
  isAdmin,
  today,
}: {
  partnerId: string;
  partnerName: string;
  repId: string | null;
  reportTo: string | null;
  statement: {
    id: string;
    quarter: string;
    rebate_pct: number;
    line_count: number;
    billed_total: number;
    margin_total: number;
    rebate_total: number;
    status: string;
    issued_at: string;
    sent_at: string | null;
    paid_on: string | null;
    paid_ref: string | null;
  };
  isAdmin: boolean;
  today: string;
}) {
  const supabase = await createClient();
  const [{ data: lines }, { data: rep }] = await Promise.all([
    supabase.from("partner_rebate_lines").select("*").eq("statement_id", st.id).order("paid_on").order("tms_reference_id"),
    repId ? supabase.from("profiles").select("full_name, email, phone").eq("id", repId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const quarter = parseQuarter(st.quarter)!;
  const forPartner = {
    partnerName,
    quarter,
    rebatePct: Number(st.rebate_pct),
    lines: (lines ?? []).map((l) => ({
      tms_reference_id: l.tms_reference_id,
      exhibitor_name: l.exhibitor_name,
      show_name: l.show_name,
      paid_on: l.paid_on,
      rebate: Number(l.rebate),
    })),
    rebateTotal: Number(st.rebate_total),
    rep: rep ? { name: rep.full_name || rep.email || "Your DTS contact", phone: rep.phone, email: rep.email } : null,
  };
  const html = renderStatementHtml(forPartner);
  const subject = statementSubject(forPartner);

  return (
    <>
      <Card>
        <CardHeader
          title={`${quarterName(quarter)} statement`}
          icon="documents"
          action={<StatusBadge status={st.status} sent={!!st.sent_at} />}
        />
        <div className="space-y-3 p-5 text-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Loads" value={String(st.line_count)} />
            <Stat label="Gross margin" value={$(st.margin_total)} />
            <Stat label={`Rebate at ${st.rebate_pct}%`} value={$(st.rebate_total)} strong />
          </div>
          <p className="text-xs text-slate-500">
            Issued {formatPacificDateTime(st.issued_at)}.{st.sent_at ? ` Sent ${formatPacificDateTime(st.sent_at)}.` : ""}
            {st.paid_on ? ` Paid ${formatDate(st.paid_on)}${st.paid_ref ? ` (${st.paid_ref})` : ""}.` : ""}
          </p>
          <ReportActions html={html} text={renderStatementText(forPartner)} subject={subject} to={reportTo} />
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <form action={markRebateSent}>
              <input type="hidden" name="statement_id" value={st.id} />
              <input type="hidden" name="partner_id" value={partnerId} />
              <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {st.sent_at ? "Sent again — log it" : "I sent it — log it"}
              </button>
            </form>
            {isAdmin && st.status !== "paid" ? (
              <form action={voidRebateStatement}>
                <input type="hidden" name="statement_id" value={st.id} />
                <input type="hidden" name="partner_id" value={partnerId} />
                <button type="submit" className="text-sm text-slate-400 hover:text-dts-maroon">
                  Void (its loads go back to waiting)
                </button>
              </form>
            ) : null}
          </div>
          {isAdmin && st.status !== "paid" ? (
            <div className="border-t border-slate-100 pt-3">
              <MarkPaidForm statementId={st.id} partnerId={partnerId} today={today} />
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="What the partner sees" icon="external" />
        <div className="p-3">
          <iframe
            title="Statement preview"
            srcDoc={`<!doctype html><html><body style="margin:12px;background:#fff">${html}</body></html>`}
            sandbox=""
            className="h-[640px] w-full rounded-lg border border-slate-100 bg-white"
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Lines (internal)" icon="reports" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={th}>DTS #</th>
                <th className={th}>Exhibitor / show</th>
                <th className={th}>Invoice</th>
                <th className={th}>Paid</th>
                <th className={`${th} text-right`}>Invoiced</th>
                <th className={`${th} text-right`}>Cost</th>
                <th className={`${th} text-right`}>Margin</th>
                <th className={`${th} text-right`}>Rebate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(lines ?? []).map((l) => (
                <tr key={l.id}>
                  <td className={td}>
                    {l.shipment_id ? (
                      <Link href={`/shipments/${l.shipment_id}`} className="text-dts-blue hover:underline">
                        {l.tms_reference_id ?? "—"}
                      </Link>
                    ) : (
                      (l.tms_reference_id ?? "—")
                    )}
                  </td>
                  <td className={td}>
                    <span className="text-slate-800">{l.exhibitor_name ?? "—"}</span>
                    <span className="block text-xs text-slate-400">{l.show_name ?? "No show"}</span>
                  </td>
                  <td className={td}>{l.invoice_nos ?? "—"}</td>
                  <td className={td}>{formatDate(l.paid_on)}</td>
                  <td className={`${td} text-right`}>{$(l.billed)}</td>
                  <td className={`${td} text-right`}>{$(l.cost)}</td>
                  <td className={`${td} text-right`}>{$(l.margin)}</td>
                  <td className={`${td} text-right font-medium`}>{$(l.rebate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
