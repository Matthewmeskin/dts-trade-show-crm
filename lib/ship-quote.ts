/**
 * The quote email for a GSC Shipping Center request. Pure (tested): the same
 * text is sent through Resend when the CRM has it, or shown to the coordinator
 * to send from their own mailbox when it does not.
 *
 * Broker language only: DTS arranges; carriers move the freight. No promises
 * about arrival, no "guaranteed". The price covers the freight as described,
 * and material handling at the show is the GSC's, billed by them.
 */

/** DTS's main line, as the website prints it. */
export const OFFICE_PHONE = "(800) 460-8540";

export type QuoteLine = { name: string; route: string; freight: string; amount: number; ownCarrier?: boolean };

export type QuoteEmailInput = {
  publicRef: string;
  showName: string;
  year: number | string;
  gscName: string;
  booth: string | null;
  contactName: string | null;
  lines: QuoteLine[];
  note: string | null;
  staffName: string | null;
  staffPhone: string | null;
  officePhone: string;
};

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const firstName = (full: string | null) => (full ?? "").trim().split(/\s+/)[0] || "there";

export function quoteEmail(q: QuoteEmailInput): { subject: string; text: string } {
  const total = q.lines.reduce((s, l) => s + l.amount, 0);
  const subject = `Pricing for your ${q.showName} ${q.year} shipping (${q.publicRef})`;
  const lines = q.lines.map((l) => `${l.name}: ${money(l.amount)}\n  ${l.route}\n  ${l.freight}`);
  const parts = [
    `Hi ${firstName(q.contactName)},`,
    `Here is our pricing for your shipping request ${q.publicRef} for ${q.showName} ${q.year}${q.booth ? `, booth ${q.booth}` : ""}.`,
    lines.join("\n\n"),
    q.lines.length > 1 ? `Total: ${money(total)}` : null,
    q.note ? q.note.trim() : null,
    `This covers transportation, arranged by DTS through our carrier network, for the freight as described above: pieces, weight, addresses and services. If any of that changes, the price can change, and we will tell you before anything is booked. Material handling at the show (moving freight between the dock and your booth) is separate and billed by ${q.gscName}.`,
    "To go ahead, approve it on your status page (the link is in the email you got when you confirmed your request), or reply to this email and say approved. Nothing is booked until you do.",
    [q.staffName ? q.staffName : "The DTS trade show team", "DTS (Diversified Transportation Services)", q.staffPhone ?? q.officePhone].join("\n"),
  ].filter(Boolean);
  return { subject, text: parts.join("\n\n") };
}

/** "Sampletown, OH to the advance warehouse" and the like. */
export function legRoute(l: {
  direction: string;
  city: string | null;
  state: string | null;
  inbound_to: string | null;
}): string {
  const place = [l.city, l.state].filter(Boolean).join(", ") || "your address";
  if (l.direction === "outbound") return `From the show to ${place}`;
  return `From ${place} to ${l.inbound_to === "direct" ? "the show site" : "the advance warehouse"}`;
}

export function legFreight(l: { pieces: number | null; weight_lbs: number | null; packaging: string | null; liftgate: boolean; inside: boolean }): string {
  const pcs = l.pieces ? `${l.pieces} piece${l.pieces === 1 ? "" : "s"}` : null;
  const lb = l.weight_lbs ? `${l.weight_lbs.toLocaleString("en-US")} lb` : null;
  const extra = [l.liftgate ? "liftgate" : null, l.inside ? "inside pickup or delivery" : null].filter(Boolean);
  return [pcs, lb, l.packaging, extra.length ? `with ${extra.join(" and ")}` : null].filter(Boolean).join(", ");
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.SHIP_EMAIL_FROM);
}

/** Send through Resend (the Shipping Center's one email path). Never throws. */
export async function sendQuoteEmail(
  to: string,
  msg: { subject: string; text: string },
  opts: { fromName: string; replyTo: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email is not set up in the CRM yet." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `${opts.fromName.replace(/["<>]/g, "")} <${process.env.SHIP_EMAIL_FROM}>`,
        to: [to],
        subject: msg.subject,
        text: msg.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `The email service refused it (${res.status}).` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The email did not send." };
  }
}
