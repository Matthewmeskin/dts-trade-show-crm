import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDigest, type DigestShow } from "@/lib/sales-digest";
import { todayYMD } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The Monday sales digest, as JSON plus ready-to-send HTML. n8n fetches this
 * and emails it; the logic lives here so the email and the calendar page can
 * never disagree about what is due.
 *
 * Auth: `Authorization: Bearer <TMS_WEBHOOK_SECRET>` (same as the TMS routes).
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.TMS_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.TMS_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "Not configured (set TMS_WEBHOOK_SECRET)." }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shows")
    .select(
      "id, show_name, edition_year, show_start_date, show_end_date, sales_people, lead_gen_owner, lead_gen_start_date, lead_gen_completion_date, emailed_two_weeks, week_before_sent, instantly_created",
    )
    .eq("archived", false);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const digest = buildDigest((data ?? []) as DigestShow[], todayYMD());
  return NextResponse.json({ ok: true, ...digest });
}
