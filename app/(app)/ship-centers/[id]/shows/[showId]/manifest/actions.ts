"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildShipManifest } from "@/lib/ship-manifest";
import { loadShowMail, manifestInput } from "@/lib/ship-mailer";
import { emailConfigured, emailList, sendShipEmail } from "@/lib/ship-quote";
import { localDay } from "@/lib/ship-reminders";

export type SendState = { error: string | null; ok?: boolean; message?: string };

/** Send the GSC's manifest or outbound list now, outside the schedule. Logged with who sent it. */
export async function sendManifestNow(_prev: SendState, fd: FormData): Promise<SendState> {
  const partnerId = String(fd.get("partner_id") ?? "");
  const showId = String(fd.get("show_id") ?? "");
  const kind = fd.get("kind") === "outbound" ? "outbound" : "inbound";
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) return { error: "Sign in again." };
  if (!emailConfigured()) return { error: "Email is not set up in the CRM yet (RESEND_API_KEY, SHIP_EMAIL_FROM)." };

  const [{ data: gsc }, { data: show }] = await Promise.all([
    supabase.from("partners").select("name, public_name, ship_email, ship_manifest_to").eq("id", partnerId).maybeSingle(),
    supabase.from("shows").select("show_name, edition_year, show_start_date").eq("id", showId).maybeSingle(),
  ]);
  if (!gsc || !show) return { error: "Show not found." };
  const to = emailList(gsc.ship_manifest_to || gsc.ship_email);
  if (!to.length) return { error: "Set where the manifest goes on the GSC's Shipping Center page first." };

  const sb = createAdminClient();
  const data = await loadShowMail(sb, showId, partnerId);
  const gscName = gsc.public_name || gsc.name;
  const m = buildShipManifest({
    kind,
    gscName,
    showName: show.show_name,
    year: show.edition_year ?? (show.show_start_date ?? "").slice(0, 4),
    today: localDay(data.timezone),
    requests: manifestInput(data),
  });
  const res = await sendShipEmail(to, m, { fromName: `DTS for ${gscName}`, replyTo: process.env.SHIP_REPLY_TO ?? null });
  await sb.from("ship_email_log").insert({
    key: `manual:${randomUUID()}`,
    kind: kind === "inbound" ? "manifest" : "outbound_list",
    partner_id: partnerId,
    show_id: showId,
    sent_to: to.join(", "),
    subject: m.subject,
    ok: res.ok,
    error: res.error ?? null,
    sent_by: me,
  });
  revalidatePath(`/ship-centers/${partnerId}/shows/${showId}/manifest`);
  return res.ok ? { error: null, ok: true, message: `Sent to ${to.join(", ")}.` } : { error: res.error ?? "It did not send." };
}
