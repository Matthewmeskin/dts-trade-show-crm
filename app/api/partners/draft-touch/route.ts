import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange, todayYMD } from "@/lib/format";
import { PARTNER_ASK, PARTNER_TYPES, SIGNAL_TYPES, labelOf, type PartnerType } from "@/lib/partners";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
  },
  required: ["subject", "body"],
  additionalProperties: false,
} as const;

const SYSTEM = `You draft first-touch outreach emails for the sales admin at Diversified Transportation Services (DTS), a family-owned freight brokerage that coordinates trade show freight in and out for exhibitors. The admin will read, edit and send what you write - it is a draft, never sent as-is.

Who we write to: companies that control freight for many exhibitors at once - exhibit houses and booth builders, regional general service contractors (GSCs), association show organizers, and I&D or experiential agencies.

Voice: sound like someone who has worked a show floor, not a marketer. Plain, short, specific. No buzzwords, no exclamation marks, no "I hope this finds you well", no "revolutionize", no "seamless".

Rules:
- Name the specific upcoming show you are given, early. The whole point of the email is that we know their calendar.
- Lead with outbound: exhibitors with nothing arranged at teardown get pushed onto the show carrier at a high price. Booking outbound before the show closes is the easy win.
- What we offer a partner: one DTS contact who knows every show on their calendar, one place to see every client shipment, outbound booked before teardown. We take the freight questions off their plate so they can focus on the booth.
- DTS is a freight broker. We coordinate, communicate and consult, and work with a strong carrier network. Never say we move, handle or haul freight ourselves. Never promise on-time delivery, never claim we prevent delays or damage, never quote rates or savings.
- Ask for one small thing: a 15-minute call with the named rep, or a reply about how they handle their clients' freight at that show.
- Under 120 words in the body. No subject line in the body. Sign off with the sender's first name and "Diversified Transportation Services" - nothing else.
- If you're given the reason we're reaching out (the signal), use it naturally; never mention tracking or that we saw them on our website.`;

/**
 * Drafts a first touch for a partner that names one of their upcoming shows.
 * Writes nothing - the admin edits and sends it, then logs the touch.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (!uid) return fail("Unauthorized", 401);
  if (!process.env.ANTHROPIC_API_KEY) return fail("Drafting isn't configured (set ANTHROPIC_API_KEY).", 503);

  const body = (await req.json().catch(() => null)) as { partner_id?: string; show_id?: string } | null;
  const partnerId = body?.partner_id;
  if (!partnerId) return fail("Missing partner.");

  const today = todayYMD();
  const [{ data: partner }, { data: links }, { data: signals }, { data: contacts }, { data: me }] = await Promise.all([
    supabase.from("partners").select("name, partner_type, city, state, client_count, rep_id, shipping_pain").eq("id", partnerId).maybeSingle(),
    supabase.from("partner_shows").select("show_id, client_count, shows(show_name, show_start_date, show_end_date)").eq("partner_id", partnerId),
    supabase
      .from("partner_signals")
      .select("signal_type, note, occurred_on")
      .eq("partner_id", partnerId)
      .is("worked_at", null)
      .order("occurred_on", { ascending: false })
      .limit(1),
    supabase.from("contacts").select("first_name, last_name, title").eq("partner_id", partnerId).limit(1),
    supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
  ]);
  if (!partner) return fail("Partner not found.", 404);

  const upcoming = (links ?? [])
    .filter((l) => l.shows?.show_start_date && l.shows.show_start_date >= today)
    .sort((a, b) => a.shows!.show_start_date!.localeCompare(b.shows!.show_start_date!));
  const show = upcoming.find((l) => l.show_id === body?.show_id) ?? upcoming[0];
  if (!show?.shows) {
    return fail("Link one of their upcoming shows first — the first touch has to name a specific show.");
  }

  const { data: rep } = partner.rep_id
    ? await supabase.from("profiles").select("full_name").eq("id", partner.rep_id).maybeSingle()
    : { data: null };
  const contact = contacts?.[0];
  const signal = signals?.[0];

  const facts = [
    `Partner: ${partner.name} (${labelOf(PARTNER_TYPES, partner.partner_type)})${partner.city ? `, ${[partner.city, partner.state].filter(Boolean).join(", ")}` : ""}`,
    `What we want from this kind of partner: ${PARTNER_ASK[partner.partner_type as PartnerType] ?? "Referrals."}`,
    `Show to name: ${show.shows.show_name}, ${formatDateRange(show.shows.show_start_date, show.shows.show_end_date)}${show.client_count ? ` - they have about ${show.client_count} clients exhibiting` : ""}`,
    upcoming.length > 1 ? `Their other upcoming shows: ${upcoming.slice(1, 3).map((l) => l.shows!.show_name).join(", ")}` : null,
    partner.client_count ? `They influence freight for about ${partner.client_count} exhibitors.` : null,
    signal ? `Why we're reaching out now: ${labelOf(SIGNAL_TYPES, signal.signal_type)}${signal.note ? ` - ${signal.note}` : ""}` : null,
    partner.shipping_pain ? `Pain they've mentioned: ${partner.shipping_pain}` : null,
    contact ? `Writing to: ${[contact.first_name, contact.last_name].filter(Boolean).join(" ")}${contact.title ? `, ${contact.title}` : ""}` : "Writing to: no name on file - open with a plain greeting.",
    `Rep for the 15-minute call: ${rep?.full_name ?? "our trade show team"}`,
    `Sender: ${me?.full_name ?? "the DTS sales team"}`,
  ].filter(Boolean);

  try {
    const client = new Anthropic();
    const message = await client.messages
      .stream({
        model: "claude-opus-5",
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: "user", content: `Draft the first-touch email.\n\n${facts.join("\n")}` }],
      })
      .finalMessage();
    if (message.stop_reason === "refusal") return fail("The drafter declined. Write this one by hand.", 502);
    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const out = JSON.parse(raw) as { subject?: unknown; body?: unknown };
    if (typeof out.subject !== "string" || typeof out.body !== "string") return fail("Couldn't read the draft. Try again.", 502);
    return NextResponse.json({ ok: true, subject: out.subject.trim(), body: out.body.trim(), show: show.shows.show_name });
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `${e.status ?? ""} ${e.message}`.trim() : e instanceof Error ? e.message : "Unknown error";
    return fail(msg, 502);
  }
}
