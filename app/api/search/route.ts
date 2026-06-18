import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { IconName } from "@/components/icons";

export const dynamic = "force-dynamic";

export type SearchHit = {
  type: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: IconName;
};

export type SearchGroup = {
  heading: string;
  items: SearchHit[];
};

const PER_TYPE = 6;

export async function GET(req: NextRequest) {
  // Strip characters that are structural in PostgREST `or()` filters so a
  // stray comma or paren can't break the query (and to keep input tidy).
  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const q = raw.replace(/[,()%*\\]/g, " ").trim();
  if (q.length < 1) return NextResponse.json({ groups: [] satisfies SearchGroup[] });

  const like = `%${q}%`;
  const supabase = await createClient();

  const [shows, venues, exhibitors, contacts, carriers, shipments] =
    await Promise.all([
      supabase
        .from("shows")
        .select("id, show_name, edition_year")
        .ilike("show_name", like)
        .order("show_name")
        .limit(PER_TYPE),
      supabase
        .from("venues")
        .select("id, venue_name, city, state")
        .or(`venue_name.ilike.${like},city.ilike.${like}`)
        .order("venue_name")
        .limit(PER_TYPE),
      supabase
        .from("exhibitors")
        .select("id, company_name, industry")
        .ilike("company_name", like)
        .order("company_name")
        .limit(PER_TYPE),
      supabase
        .from("contacts")
        .select("id, first_name, last_name, company, title")
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},company.ilike.${like}`,
        )
        .limit(PER_TYPE),
      supabase
        .from("carriers")
        .select("id, carrier_name")
        .ilike("carrier_name", like)
        .order("carrier_name")
        .limit(PER_TYPE),
      supabase
        .from("shipments")
        .select(
          "id, pro_number, tms_reference_id, status, exhibitor:exhibitors(company_name), show:shows(show_name)",
        )
        .or(`pro_number.ilike.${like},tms_reference_id.ilike.${like}`)
        .limit(PER_TYPE),
    ]);

  const groups: SearchGroup[] = [];

  const showItems: SearchHit[] = (shows.data ?? []).map((s) => ({
    type: "show",
    label: s.show_name,
    sublabel: s.edition_year ? String(s.edition_year) : undefined,
    href: `/shows/${s.id}`,
    icon: "shows",
  }));
  if (showItems.length) groups.push({ heading: "Shows", items: showItems });

  const shipmentItems: SearchHit[] = (shipments.data ?? []).map((s) => {
    const ref = s.pro_number || s.tms_reference_id || "Shipment";
    const ctx = [s.show?.show_name, s.exhibitor?.company_name]
      .filter(Boolean)
      .join(" · ");
    return {
      type: "shipment",
      label: `PRO ${ref}`,
      sublabel: ctx || (s.status ? String(s.status) : undefined),
      href: `/shipments/${s.id}`,
      icon: "shipments",
    };
  });
  if (shipmentItems.length)
    groups.push({ heading: "Shipments", items: shipmentItems });

  const exhibitorItems: SearchHit[] = (exhibitors.data ?? []).map((e) => ({
    type: "exhibitor",
    label: e.company_name,
    sublabel: e.industry ?? undefined,
    href: `/exhibitors/${e.id}`,
    icon: "exhibitors",
  }));
  if (exhibitorItems.length)
    groups.push({ heading: "Exhibitors", items: exhibitorItems });

  const contactItems: SearchHit[] = (contacts.data ?? []).map((c) => {
    const name =
      [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact";
    const ctx = [c.title, c.company].filter(Boolean).join(" · ");
    return {
      type: "contact",
      label: name,
      sublabel: ctx || undefined,
      href: `/contacts/${c.id}`,
      icon: "contacts",
    };
  });
  if (contactItems.length)
    groups.push({ heading: "Contacts", items: contactItems });

  const carrierItems: SearchHit[] = (carriers.data ?? []).map((c) => ({
    type: "carrier",
    label: c.carrier_name,
    href: `/carriers/${c.id}`,
    icon: "carriers",
  }));
  if (carrierItems.length)
    groups.push({ heading: "Carriers", items: carrierItems });

  const venueItems: SearchHit[] = (venues.data ?? []).map((v) => ({
    type: "venue",
    label: v.venue_name,
    sublabel: [v.city, v.state].filter(Boolean).join(", ") || undefined,
    href: `/venues/${v.id}`,
    icon: "venues",
  }));
  if (venueItems.length) groups.push({ heading: "Venues", items: venueItems });

  return NextResponse.json({ groups });
}
