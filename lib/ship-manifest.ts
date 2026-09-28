import { publicStatus } from "@/lib/ship-status";

/**
 * The GSC's emails for a Shipping Center show (spec section 7, "Also emailed"):
 *
 *   inbound manifest  every booth sending freight with DTS: to the advance
 *                     warehouse or the show site, pieces, weight, when it is
 *                     ready or booked, the carrier and PRO once booked.
 *                     Weekly, then daily the last week before move in.
 *   outbound list     every booth with outbound booked or requested, and the
 *                     booths that came in with DTS with no way home yet.
 *                     Daily from the show opening through teardown.
 *
 * Built from the requests inbox, not the TMS alone, so a GSC sees what is
 * coming before it is booked. Never a price, a margin or a note; exhibitor
 * email and phone stay off it (open question 5): company, contact, booth.
 * Pure (tested).
 */

export type ManifestLoad = {
  status: string | null;
  carrier_name: string | null;
  pro_number: string | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
};

export type ManifestLeg = {
  direction: string;
  seq: number;
  stage: string;
  own_carrier: boolean;
  inbound_to: string | null;
  city: string | null;
  state: string | null;
  pieces: number | null;
  weight_lbs: number | null;
  ready_date: string | null;
  onsite_contact_name: string | null;
  load: ManifestLoad | null;
};

export type ManifestRequest = {
  company: string | null;
  contact_name: string | null;
  booth: string | null;
  booth_tbd: boolean;
  closed: string | null;
  legs: ManifestLeg[];
};

export type ManifestLine = {
  booth: string;
  company: string;
  contact: string;
  where: string;
  pieces: number | null;
  weight: number | null;
  status: string;
  when: string;
  carrier: string;
  pro: string;
};

const LABEL: Record<string, string> = {
  requested: "Not booked yet",
  quoted: "Not booked yet",
  approved: "Being booked",
  booked: "Booked",
  in_transit: "Picked up",
  delivered: "Delivered",
  issue: "Being checked",
};

const short = (ymd: string | null) =>
  ymd ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";

const boothOf = (r: ManifestRequest) => (r.booth_tbd || !r.booth ? "TBD" : r.booth);
const byBooth = (a: ManifestLine, b: ManifestLine) =>
  a.booth === "TBD" ? 1 : b.booth === "TBD" ? -1 : a.booth.localeCompare(b.booth, "en", { numeric: true });

function line(r: ManifestRequest, l: ManifestLeg, where: string): ManifestLine {
  const status = publicStatus(l.stage, l.load?.status ?? null);
  const tracked = status === "booked" || status === "in_transit" || status === "delivered" || status === "issue";
  let when = "";
  if (l.direction === "inbound") {
    if (l.load?.actual_delivery_date) when = `Delivered ${short(l.load.actual_delivery_date)}`;
    else if (tracked && l.load?.estimated_delivery_date) when = `Carrier's estimate ${short(l.load.estimated_delivery_date)}`;
    else if (tracked && l.load?.pickup_date) when = `Pickup ${short(l.load.pickup_date)}`;
    else if (l.ready_date) when = `Ready ${short(l.ready_date)}`;
  } else if (tracked && l.load?.pickup_date) when = `Pickup ${short(l.load.pickup_date)}`;
  return {
    booth: boothOf(r),
    company: r.company ?? "(company removed)",
    contact: l.direction === "outbound" ? l.onsite_contact_name ?? r.contact_name ?? "" : r.contact_name ?? "",
    where,
    pieces: l.pieces,
    weight: l.weight_lbs,
    status: LABEL[status] ?? "Not booked yet",
    when,
    carrier: tracked ? l.load?.carrier_name ?? "" : "",
    pro: tracked ? l.load?.pro_number ?? "" : "",
  };
}

export type ShipManifest = {
  kind: "inbound" | "outbound";
  subject: string;
  lines: ManifestLine[];
  /** Outbound list only: booths coming in with DTS with no outbound on their request. */
  noOutbound: { booth: string; company: string }[];
  text: string;
  html: string;
};

export function buildShipManifest(input: {
  kind: "inbound" | "outbound";
  gscName: string;
  showName: string;
  year: number | string;
  today: string;
  requests: ManifestRequest[];
}): ShipManifest {
  const live = input.requests.filter((r) => !r.closed);
  const lines: ManifestLine[] = [];
  const noOutbound: { booth: string; company: string }[] = [];
  for (const r of live) {
    const legs = r.legs.filter((l) => l.stage !== "cancelled" && !l.own_carrier);
    if (input.kind === "inbound") {
      for (const l of legs.filter((x) => x.direction === "inbound")) {
        lines.push(line(r, l, l.inbound_to === "direct" ? "Show site" : "Advance warehouse"));
      }
    } else {
      const out = legs.filter((x) => x.direction === "outbound");
      for (const l of out) lines.push(line(r, l, [l.city, l.state].filter(Boolean).join(", ")));
      if (!out.length && legs.some((x) => x.direction === "inbound")) noOutbound.push({ booth: boothOf(r), company: r.company ?? "" });
    }
  }
  lines.sort(byBooth);
  noOutbound.sort((a, b) => (a.booth === "TBD" ? 1 : b.booth === "TBD" ? -1 : a.booth.localeCompare(b.booth, "en", { numeric: true })));

  const show = `${input.showName} ${input.year}`;
  const title = input.kind === "inbound" ? "Inbound manifest" : "Outbound list";
  const subject = `${show}: DTS ${title.toLowerCase()}, ${short(input.today)}`;
  const pieces = lines.reduce((s, l) => s + (l.pieces ?? 0), 0);
  const weight = lines.reduce((s, l) => s + (l.weight ?? 0), 0);
  const summary =
    input.kind === "inbound"
      ? `${lines.length} shipment${lines.length === 1 ? "" : "s"} coming in with DTS: ${pieces} pieces, about ${weight.toLocaleString("en-US")} lb.`
      : `${lines.length} booth${lines.length === 1 ? "" : "s"} shipping out with DTS.${noOutbound.length ? ` ${noOutbound.length} came in with DTS and have no outbound yet.` : ""}`;

  const cols =
    input.kind === "inbound"
      ? (["Booth", "Exhibitor", "Contact", "To", "Pieces", "Lb", "Status", "When", "Carrier", "PRO"] as const)
      : (["Booth", "Exhibitor", "On-site contact", "Going to", "Pieces", "Lb", "Status", "When", "Carrier", "PRO"] as const);
  const cells = (l: ManifestLine) => [l.booth, l.company, l.contact, l.where, l.pieces ?? "", l.weight?.toLocaleString("en-US") ?? "", l.status, l.when, l.carrier, l.pro].map(String);

  const text = [
    `${title} for ${show}, from DTS (${input.gscName} Shipping Center).`,
    summary,
    lines.length ? lines.map((l) => cells(l).filter(Boolean).join(" | ")).join("\n") : "Nothing yet.",
    noOutbound.length ? `No outbound yet:\n${noOutbound.map((n) => `${n.booth} | ${n.company}`).join("\n")}` : null,
    "DTS is a freight broker: we arrange and coordinate the shipping; carriers move the freight. Questions: (800) 460-8540.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const td = 'style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;vertical-align:top"';
  const th = 'style="padding:6px 8px;border-bottom:2px solid #d1d5db;font-size:12px;text-align:left;color:#4b5563"';
  const table = lines.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr>${cols.map((c) => `<th ${th}>${c}</th>`).join("")}</tr></thead><tbody>${lines
        .map((l) => `<tr>${cells(l).map((c, i) => `<td ${td}>${i === 0 ? `<strong>${esc(c)}</strong>` : esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`
    : `<p style="color:#6b7280">Nothing yet.</p>`;
  const missing = noOutbound.length
    ? `<h2 style="font-size:15px;margin:22px 0 6px 0">Came in with DTS, no outbound yet</h2><p style="margin:0;font-size:13px">${noOutbound
        .map((n) => `<strong>${esc(n.booth)}</strong> ${esc(n.company)}`)
        .join("<br>")}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Helvetica,Arial,sans-serif;color:#1f2937"><div style="max-width:960px;margin:0 auto;padding:20px 12px"><div style="background:#fff;border-radius:12px;padding:22px">
<p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${esc(input.gscName)} Shipping Center</p>
<h1 style="margin:4px 0 6px 0;font-size:20px">${title}: ${esc(show)}</h1>
<p style="margin:0 0 16px 0;font-size:14px">${esc(summary)}</p>
${table}${missing}
<p style="margin:20px 0 0 0;font-size:12px;color:#6b7280">From DTS (Diversified Transportation Services), a freight broker: we arrange and coordinate the shipping; carriers move the freight. Questions: (800) 460-8540.</p>
</div></div></body></html>`;

  return { kind: input.kind, subject, lines, noOutbound, text, html };
}
