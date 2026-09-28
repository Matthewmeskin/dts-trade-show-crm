import { createAdminClient } from "@/lib/supabase/admin";
import { manifestCadence } from "@/lib/gsc-manifest";
import { weekStart } from "@/lib/partners";
import { buildShipManifest, type ManifestLoad, type ManifestRequest } from "@/lib/ship-manifest";
import { OFFICE_PHONE, emailConfigured, emailList, fromNameFor, sendShipEmail } from "@/lib/ship-quote";
import {
  SEND_FROM_HOUR,
  SEND_UNTIL_HOUR,
  dueReminders,
  localDay,
  localHour,
  reminderEmail,
  type ReminderKind,
} from "@/lib/ship-reminders";

/**
 * The GSC Shipping Center's scheduled email (slice 6), run from the 15 minute
 * sync. For every enabled Shipping Center show, in the show's own timezone
 * and only between 8am and 6pm there:
 *   - the GSC's inbound manifest (weekly, then daily the last week before
 *     move in) when the show's manifest_email is on;
 *   - the GSC's outbound list (daily from the show opening through teardown)
 *     when outbound_email is on;
 *   - the exhibitor reminders (lib/ship-reminders.ts).
 * Each email is claimed in ship_email_log by a unique key before it is sent,
 * so it goes once however many runs overlap; a send that fails gives its
 * claim back and is tried again on the next run.
 *
 * Env: RESEND_API_KEY and SHIP_EMAIL_FROM (nothing sends without them),
 * SHIP_REPLY_TO (the team inbox, for the GSC's emails), SHIP_BASE_URL (the
 * Shipping Center's address, for links in reminders; optional).
 */

export type MailResult = { ok: boolean; skipped?: boolean; sent: number; failed: number; error?: string };

type Sb = ReturnType<typeof createAdminClient>;

const SHOW_FIELDS =
  "id, show_name, edition_year, show_start_date, show_end_date, move_in_start, move_in_end, move_out_start, move_out_end, advance_warehouse_cutoff";

/** Claim a key, send, record the answer. False if someone already claimed it. */
async function sendOnce(
  sb: Sb,
  entry: { key: string; kind: string; partner_id: string | null; show_id: string | null; request_id: string | null; sent_by?: string | null },
  to: string[],
  msg: { subject: string; text: string; html?: string },
  opts: { fromName: string; replyTo: string | null },
): Promise<"sent" | "failed" | "skip"> {
  const { data: claimed } = await sb
    .from("ship_email_log")
    .upsert({ ...entry, sent_to: to.join(", "), subject: msg.subject }, { onConflict: "key", ignoreDuplicates: true })
    .select("id");
  if (!claimed?.length) return "skip";
  const res = await sendShipEmail(to, msg, opts);
  if (!res.ok) {
    // Let it go again on the next run (Resend down, a setting missing).
    await sb.from("ship_email_log").delete().eq("id", claimed[0].id);
    console.error("[ship-mail]", entry.key, res.error);
    return "failed";
  }
  await sb.from("ship_email_log").update({ ok: true }).eq("id", claimed[0].id);
  return "sent";
}

const base = () => (process.env.SHIP_BASE_URL ?? "").replace(/\/+$/, "") || null;

/** Everything one show's emails are built from. */
export async function loadShowMail(sb: Sb, showId: string, partnerId: string) {
  const [{ data: reqs }, { data: logi }] = await Promise.all([
    sb
      .from("ship_request_inbox")
      .select("id, public_ref, show_snapshot, company, contact_name, email, booth, booth_tbd, closed, assigned_to, ship_request_legs(*)")
      .eq("show_id", showId)
      .eq("partner_id", partnerId)
      .limit(2000),
    sb.from("show_public_logistics").select("timezone").eq("show_id", showId).maybeSingle(),
  ]);
  const legIds = (reqs ?? []).flatMap((r) => (r.ship_request_legs ?? []).map((l) => l.id));
  const loads = new Map<string, ManifestLoad>();
  const quotedAt = new Map<string, string>();
  for (let i = 0; i < legIds.length; i += 300) {
    const chunk = legIds.slice(i, i + 300);
    const [{ data: ships }, { data: quotes }] = await Promise.all([
      sb
        .from("shipments")
        .select("ship_leg_id, status, pro_number, pickup_date, estimated_delivery_date, actual_delivery_date, carriers(carrier_name)")
        .in("ship_leg_id", chunk),
      sb.from("ship_quotes").select("leg_id, sent_at").in("leg_id", chunk),
    ]);
    for (const s of ships ?? []) if (s.ship_leg_id) loads.set(s.ship_leg_id, { ...s, carrier_name: s.carriers?.carrier_name ?? null });
    for (const q of quotes ?? []) if (!quotedAt.has(q.leg_id) || quotedAt.get(q.leg_id)! < q.sent_at) quotedAt.set(q.leg_id, q.sent_at);
  }
  return { requests: reqs ?? [], loads, quotedAt, timezone: logi?.timezone ?? null };
}

export function manifestInput(data: Awaited<ReturnType<typeof loadShowMail>>): ManifestRequest[] {
  return data.requests.map((r) => ({
    company: r.company,
    contact_name: r.contact_name,
    booth: r.booth,
    booth_tbd: r.booth_tbd,
    closed: r.closed,
    legs: (r.ship_request_legs ?? []).map((l) => ({ ...l, load: data.loads.get(l.id) ?? null })),
  }));
}

export async function runShipMail(now: Date = new Date()): Promise<MailResult> {
  if (!emailConfigured()) return { ok: true, skipped: true, sent: 0, failed: 0 };
  const sb = createAdminClient();
  let sent = 0;
  let failed = 0;
  try {
    const { data: ships, error } = await sb
      .from("ship_shows")
      .select(`partner_id, show_id, manifest_email, outbound_email, dock_map_url, partners(name, public_name, code, ship_email, ship_manifest_to), shows(${SHOW_FIELDS})`)
      .eq("enabled", true);
    if (error) throw new Error(error.message);
    const { data: staff } = await sb.from("profiles").select("id, full_name, email");
    const staffBy = new Map((staff ?? []).map((p) => [p.id, p]));

    for (const ss of ships ?? []) {
      const show = ss.shows;
      const gsc = ss.partners;
      if (!show || !gsc) continue;
      const data = await loadShowMail(sb, ss.show_id, ss.partner_id);
      const tz = data.timezone;
      const hour = localHour(tz, now);
      if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) continue;
      const today = localDay(tz, now);
      const gscName = gsc.public_name || gsc.name;
      const year = show.edition_year ?? (show.show_start_date ?? "").slice(0, 4);
      const from = fromNameFor(gscName);
      const teamReply = process.env.SHIP_REPLY_TO ?? null;

      // The GSC's manifest or outbound list, by the same calendar as the CRM's GSC manifest.
      const cadence = manifestCadence(
        { ...show, advance_warehouse_open: null, advance_warehouse_name: null },
        today,
      );
      const to = emailList(gsc.ship_manifest_to || gsc.ship_email);
      const wants =
        (cadence === "weekly" || cadence === "daily") && ss.manifest_email === "weekly_then_daily"
          ? { kind: "manifest" as const, period: cadence === "weekly" ? weekStart(today) : today }
          : cadence === "outbound" && ss.outbound_email
            ? { kind: "outbound_list" as const, period: today }
            : null;
      if (wants && to.length) {
        const m = buildShipManifest({
          kind: wants.kind === "manifest" ? "inbound" : "outbound",
          gscName,
          showName: show.show_name,
          year,
          today,
          requests: manifestInput(data),
        });
        const r = await sendOnce(
          sb,
          { key: `${wants.kind}:${ss.show_id}:${ss.partner_id}:${wants.period}`, kind: wants.kind, partner_id: ss.partner_id, show_id: ss.show_id, request_id: null },
          to,
          m,
          { fromName: `DTS for ${gscName}`, replyTo: teamReply },
        );
        if (r === "sent") sent++;
        if (r === "failed") failed++;
      }

      // The exhibitor reminders.
      for (const req of data.requests) {
        const legs = (req.ship_request_legs ?? []).map((l) => ({
          ...l,
          pickup_date: data.loads.get(l.id)?.pickup_date ?? null,
          quoted_at: data.quotedAt.get(l.id) ?? null,
        }));
        const due = dueReminders({ id: req.id, closed: req.closed, email: req.email, booth_tbd: req.booth_tbd, legs }, show, today);
        if (!due.length || !req.email) continue;
        const snap = (req.show_snapshot ?? {}) as Record<string, unknown>;
        const staffer = req.assigned_to ? staffBy.get(req.assigned_to) : undefined;
        for (const d of due) {
          const first = legs.find((l) => d.legIds.includes(l.id));
          const outbound = legs.find((l) => l.direction === "outbound" && l.stage !== "cancelled");
          const msg = reminderEmail(d.kind as ReminderKind, {
            publicRef: req.public_ref,
            contactName: req.contact_name,
            showName: show.show_name,
            year,
            gscName,
            booth: req.booth,
            moveIn: show.move_in_start ?? show.show_start_date,
            moveOut: show.move_out_start ?? show.show_end_date,
            requestUrl: base() && snap.series_slug ? `${base()}/ship/${gsc.code}/${String(snap.series_slug)}/${year}/request/` : null,
            linkUrl: base() ? `${base()}/ship/link/?ref=${encodeURIComponent(req.public_ref)}` : null,
            pickupDate: first?.pickup_date ?? first?.ready_date ?? null,
            pieces: first?.pieces ?? null,
            onsiteName: outbound?.onsite_contact_name ?? null,
            onsiteMobile: outbound?.onsite_contact_mobile ?? null,
            dockMapUrl: ss.dock_map_url,
            staffName: staffer?.full_name ?? null,
            phone: OFFICE_PHONE,
          });
          const r = await sendOnce(
            sb,
            { key: d.key, kind: d.kind, partner_id: ss.partner_id, show_id: ss.show_id, request_id: req.id },
            [req.email],
            msg,
            { fromName: from, replyTo: staffer?.email ?? teamReply },
          );
          if (r === "sent") sent++;
          if (r === "failed") failed++;
        }
      }
    }
    return { ok: failed === 0, sent, failed, ...(failed ? { error: `${failed} email${failed === 1 ? "" : "s"} did not send` } : {}) };
  } catch (e) {
    return { ok: false, sent, failed, error: e instanceof Error ? e.message : String(e) };
  }
}
