import { formatDate } from "@/lib/format";

/**
 * Partner credit and the quarterly rebate statement.
 *
 * The rebate model (Partner Growth Plan): DTS bills the exhibitor; the partner
 * who sent them earns a share of DTS gross margin, paid quarterly, on PAID
 * invoices only. So a load earns a rebate when all three are true:
 *
 *   1. a person credited it to the partner (shipments.partner_id)
 *   2. its customer invoice is paid in Sage (shipment_ar_status = 'paid')
 *   3. it isn't on an earlier statement (a load is paid on once, ever)
 *
 * A statement for a quarter takes every load paid by the quarter's last day
 * that no earlier statement took, so a load credited late is carried into the
 * next statement instead of being lost.
 *
 * Money figures: billed is what Sage says the customer was invoiced when it
 * says (its AR extract carries no amounts as of 2026-09), otherwise the TMS
 * billed amount; cost is the TMS carrier cost; margin is the difference. The partner-facing statement never shows cost or margin.
 */

export type ArStatus = "paid" | "open" | "not_in_ledger" | "no_reference" | "no_ledger";

export type ArRow = {
  shipment_id: string;
  ar_status: ArStatus | string;
  invoice_nos: string[] | null;
  invoiced: number | null;
  open_balance: number | null;
  paid_on: string | null;
};

export type CreditedShipment = {
  id: string;
  tms_reference_id: string | null;
  status: string;
  billed_amount: number | null;
  cost_amount: number | null;
  cancelled_at: string | null;
  pickup_date: string | null;
  exhibitor_name: string | null;
  show_name: string | null;
  partner_credit_source: string | null;
};

export type Quarter = { label: string; start: string; end: string };

export type RebateLine = {
  shipment_id: string;
  tms_reference_id: string | null;
  exhibitor_name: string | null;
  show_name: string | null;
  invoice_nos: string;
  paid_on: string;
  billed: number;
  cost: number;
  margin: number;
  rebate: number;
  /** Paid before this quarter began: credited late, carried in. */
  carried: boolean;
};

export type WaitingLine = {
  shipment_id: string;
  tms_reference_id: string | null;
  exhibitor_name: string | null;
  show_name: string | null;
  why: string;
  owed: number | null;
};

export type CheckLine = { shipment_id: string; tms_reference_id: string | null; exhibitor_name: string | null; problem: string };

export type RebateDraft = {
  quarter: Quarter;
  rebatePct: number | null;
  lines: RebateLine[];
  totals: { loads: number; billed: number; margin: number; rebate: number };
  /** Credited, not paid yet (or not invoiced yet). Next statement, probably. */
  waiting: WaitingLine[];
  /** Paid after the quarter closed: they go on the next statement. */
  paidAfter: number;
  /** Paid but held off the statement until someone looks. */
  checks: CheckLine[];
  /** On the statement, but worth a glance before issuing. */
  notes: CheckLine[];
  /** Why the statement can't be issued yet, in plain words. Empty = ready. */
  blockers: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A billed amount that differs from Sage by more than this gets a note. */
export const BILLED_DIFF_TOLERANCE = 1;

// ---------------------------------------------------------------------------
// Quarters (calendar quarters, by Pacific day strings)
// ---------------------------------------------------------------------------

export function quarterOf(ymd: string): Quarter {
  const y = Number(ymd.slice(0, 4));
  const q = Math.floor((Number(ymd.slice(5, 7)) - 1) / 3) + 1;
  return quarter(y, q);
}

function quarter(y: number, q: number): Quarter {
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
  const mm = (m: number) => String(m).padStart(2, "0");
  return { label: `${y}-Q${q}`, start: `${y}-${mm(startMonth)}-01`, end: `${y}-${mm(endMonth)}-${lastDay}` };
}

export function parseQuarter(label: string | null | undefined): Quarter | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(label ?? "");
  return m ? quarter(Number(m[1]), Number(m[2])) : null;
}

export function previousQuarter(q: Quarter): Quarter {
  const y = Number(q.label.slice(0, 4));
  const n = Number(q.label.slice(-1));
  return n === 1 ? quarter(y - 1, 4) : quarter(y, n - 1);
}

/** This quarter and the ones before it, newest first. */
export function recentQuarters(today: string, count: number): Quarter[] {
  const out = [quarterOf(today)];
  while (out.length < count) out.push(previousQuarter(out[out.length - 1]));
  return out;
}

/** "Q4 2026" */
export function quarterName(q: Quarter): string {
  return `Q${q.label.slice(-1)} ${q.label.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// The draft statement
// ---------------------------------------------------------------------------

export function buildRebateDraft(input: {
  quarter: Quarter;
  incentiveModel: string | null;
  rebatePct: number | null;
  shipments: CreditedShipment[];
  ar: ArRow[];
  /** Shipment ids already on an issued statement. */
  alreadyStated: Set<string>;
  /** The quarter already has a statement. */
  quarterIssued: boolean;
  today: string;
}): RebateDraft {
  const { quarter: q } = input;
  const pct = input.rebatePct != null && input.rebatePct > 0 ? Number(input.rebatePct) : null;
  const arBy = new Map(input.ar.map((a) => [a.shipment_id, a]));
  const lines: RebateLine[] = [];
  const waiting: WaitingLine[] = [];
  const checks: CheckLine[] = [];
  const notes: CheckLine[] = [];
  let paidAfter = 0;

  for (const s of input.shipments) {
    if (input.alreadyStated.has(s.id)) continue;
    const ar = arBy.get(s.id);
    const who = { shipment_id: s.id, tms_reference_id: s.tms_reference_id, exhibitor_name: s.exhibitor_name };
    const status = ar?.ar_status ?? "not_in_ledger";

    if (status !== "paid" || !ar?.paid_on) {
      if (s.cancelled_at || s.status === "quoted") continue; // never going to be invoiced
      waiting.push({
        ...who,
        show_name: s.show_name,
        why:
          status === "open"
            ? `Invoiced (${(ar?.invoice_nos ?? []).join(", ") || "Sage"}), not paid yet`
            : status === "no_reference"
              ? "No TMS load number, so it can't be matched to an invoice"
              : status === "no_ledger"
                ? "No Sage ledger connected to this CRM"
                : "Not invoiced in Sage yet",
        owed: status === "open" ? (ar?.open_balance ?? null) : null,
      });
      continue;
    }

    if (ar.paid_on > q.end) {
      paidAfter++;
      continue;
    }
    if (s.cancelled_at) {
      checks.push({ ...who, problem: "Marked cancelled in the CRM but its invoice is paid. Check which is right." });
      continue;
    }
    // Sage's invoice amount when it has one; its AR extract leaves it at 0
    // today, so in practice this is the TMS billed amount.
    const billed = ar.invoiced != null && Number(ar.invoiced) > 0 ? Number(ar.invoiced) : s.billed_amount;
    if (billed == null || s.cost_amount == null) {
      checks.push({ ...who, problem: "No carrier cost in the TMS yet, so there's no margin to figure a rebate on." });
      continue;
    }
    const margin = round2(billed - Number(s.cost_amount));
    if (margin <= 0) {
      checks.push({ ...who, problem: `Margin is $${margin.toFixed(2)}. Nothing to rebate unless the cost is wrong.` });
      continue;
    }
    if (s.billed_amount != null && Math.abs(Number(s.billed_amount) - billed) > BILLED_DIFF_TOLERANCE) {
      // Not a hold: Sage is what was paid. Just worth knowing.
      notes.push({
        ...who,
        problem: `TMS billed $${Number(s.billed_amount).toFixed(2)}, Sage invoiced $${billed.toFixed(2)}. Using Sage (it's what was paid).`,
      });
    }
    lines.push({
      shipment_id: s.id,
      tms_reference_id: s.tms_reference_id,
      exhibitor_name: s.exhibitor_name,
      show_name: s.show_name,
      invoice_nos: (ar.invoice_nos ?? []).join(", "),
      paid_on: ar.paid_on,
      billed: round2(billed),
      cost: round2(Number(s.cost_amount)),
      margin,
      rebate: pct ? round2((margin * pct) / 100) : 0,
      carried: ar.paid_on < q.start,
    });
  }

  lines.sort((a, b) => a.paid_on.localeCompare(b.paid_on) || (a.tms_reference_id ?? "").localeCompare(b.tms_reference_id ?? ""));
  waiting.sort((a, b) => (a.tms_reference_id ?? "").localeCompare(b.tms_reference_id ?? ""));

  const totals = {
    loads: lines.length,
    billed: round2(lines.reduce((t, l) => t + l.billed, 0)),
    margin: round2(lines.reduce((t, l) => t + l.margin, 0)),
    rebate: round2(lines.reduce((t, l) => t + l.rebate, 0)),
  };

  const blockers: string[] = [];
  if (input.incentiveModel !== "rebate") blockers.push("This partner isn't on the rebate model. Set it under Terms.");
  else if (!pct) blockers.push("No rebate % set under Terms.");
  if (input.quarterIssued) blockers.push(`${quarterName(q)} already has a statement.`);
  else if (q.end >= input.today) blockers.push(`${quarterName(q)} isn't over until ${formatDate(q.end)}. Issue it after that.`);
  if (!lines.length) blockers.push("No paid, credited loads to put on it.");

  return { quarter: q, rebatePct: pct, lines, totals, waiting, paidAfter, checks, notes, blockers };
}

// ---------------------------------------------------------------------------
// Suggesting credit
// ---------------------------------------------------------------------------

export type SuggestClient = { exhibitor_id: string; company_name: string; linked_on: string };
export type SuggestShipment = {
  id: string;
  exhibitor_id: string | null;
  partner_id: string | null;
  status: string;
  cancelled_at: string | null;
  tms_reference_id: string | null;
  /** When the load was booked (TMS created date, or the CRM's). */
  booked_on: string;
  show_name: string | null;
  billed_amount: number | null;
  /** 'tms' or 'ship_center'. Shipping Center loads never earn partner credit. */
  source?: string;
};

export type CreditSuggestion = SuggestShipment & { client: string; reason: string };

/**
 * Loads from this partner's clients that nobody has credited to anyone yet,
 * booked on or after the day the client was linked to the partner - a load
 * the exhibitor booked before the partner relationship isn't the partner's.
 * Quotes wait until they book. A person still decides; this only lists them.
 */
export function creditSuggestions(clients: SuggestClient[], shipments: SuggestShipment[]): CreditSuggestion[] {
  const byExhibitor = new Map(clients.map((c) => [c.exhibitor_id, c]));
  const out: CreditSuggestion[] = [];
  for (const s of shipments) {
    if (s.partner_id || s.cancelled_at || s.status === "quoted" || !s.exhibitor_id) continue;
    if (s.source === "ship_center") continue;
    const c = byExhibitor.get(s.exhibitor_id);
    if (!c || s.booked_on < c.linked_on) continue;
    out.push({ ...s, client: c.company_name, reason: `${c.company_name} is their client` });
  }
  return out.sort((a, b) => b.booked_on.localeCompare(a.booked_on));
}

// ---------------------------------------------------------------------------
// The statement the partner gets
// ---------------------------------------------------------------------------

export type StatementForPartner = {
  partnerName: string;
  quarter: Quarter;
  rebatePct: number;
  lines: Pick<RebateLine, "tms_reference_id" | "exhibitor_name" | "show_name" | "paid_on" | "rebate">[];
  rebateTotal: number;
  rep: { name: string; phone: string | null; email: string | null } | null;
};

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signOff = (rep: StatementForPartner["rep"]) =>
  rep ? [rep.name, rep.phone, rep.email].filter(Boolean).join(" · ") : "Your DTS trade show team";

export function statementSubject(s: Pick<StatementForPartner, "partnerName" | "quarter">): string {
  return `${quarterName(s.quarter)} rebate statement for ${s.partnerName}`;
}

/**
 * Shipment, exhibitor, show, the day it was paid and the rebate on it. Never
 * cost, margin or what the exhibitor was billed.
 */
export function renderStatementHtml(s: StatementForPartner): string {
  const td = "padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;vertical-align:top;";
  const th = "padding:5px 8px;border-bottom:1px solid #cbd5e1;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;text-align:left;";
  const right = "text-align:right;";
  const rows = s.lines
    .map(
      (l) =>
        `<tr><td style="${td}">${esc(l.tms_reference_id ?? "—")}</td><td style="${td}">${esc(l.exhibitor_name ?? "—")}</td><td style="${td}">${esc(l.show_name ?? "—")}</td><td style="${td}">${esc(formatDate(l.paid_on))}</td><td style="${td}${right}">${money(l.rebate)}</td></tr>`,
    )
    .join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:760px;">
<p style="font-size:14px;margin:0 0 4px;">Hi ${esc(s.partnerName)} team,</p>
<p style="font-size:14px;margin:0 0 14px;color:#334155;">Here's your rebate statement for ${esc(quarterName(s.quarter))}: every shipment you sent our way whose invoice was paid by ${esc(formatDate(s.quarter.end))}. Your rebate is ${s.rebatePct}% of DTS gross margin on each one.</p>
<p style="font-size:13px;color:#334155;margin:0 0 10px;"><strong>${s.lines.length} shipment${s.lines.length === 1 ? "" : "s"} · ${money(s.rebateTotal)} earned</strong></p>
<table style="border-collapse:collapse;width:100%;"><tr><th style="${th}">DTS #</th><th style="${th}">Exhibitor</th><th style="${th}">Show</th><th style="${th}">Invoice paid</th><th style="${th}${right}">Rebate</th></tr>
${rows}
<tr><td style="${td}" colspan="4"><strong>Total</strong></td><td style="${td}${right}"><strong>${money(s.rebateTotal)}</strong></td></tr>
</table>
<p style="font-size:12px;color:#64748b;margin:18px 0 4px;">Shipments still waiting on payment will be on a later statement once they're paid. Questions on any line, just reply.</p>
<p style="font-size:13px;color:#334155;margin:12px 0 0;">Thank you for the referrals.<br>${esc(signOff(s.rep))}<br>Diversified Transportation Services</p>
</div>`;
}

export function renderStatementText(s: StatementForPartner): string {
  const lines = [
    `Your rebate statement for ${quarterName(s.quarter)}: shipments you sent our way whose invoice was paid by ${formatDate(s.quarter.end)}. Rebate is ${s.rebatePct}% of DTS gross margin.`,
    "",
    `${s.lines.length} shipment${s.lines.length === 1 ? "" : "s"} · ${money(s.rebateTotal)} earned`,
    "",
    ...s.lines.map(
      (l) => `- DTS # ${l.tms_reference_id ?? "—"} · ${l.exhibitor_name ?? "—"} · ${l.show_name ?? "—"} · paid ${formatDate(l.paid_on)} · ${money(l.rebate)}`,
    ),
    "",
    "Shipments still waiting on payment will be on a later statement once they're paid. Questions on any line, just reply.",
    "",
    "Thank you for the referrals.",
    signOff(s.rep),
    "Diversified Transportation Services",
  ];
  return lines.join("\n");
}
