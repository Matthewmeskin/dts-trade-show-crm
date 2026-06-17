import type { Enums } from "@/lib/database.types";

export type ContactType = Enums<"contact_type">;

export const CONTACT_TYPE_META: Record<
  ContactType,
  { label: string; badge: string }
> = {
  gsc_rep: {
    label: "GSC rep",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
  },
  venue_coordinator: {
    label: "Venue coordinator",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  exhibitor_contact: {
    label: "Exhibitor contact",
    badge: "bg-dts-maroon/10 text-dts-maroon ring-1 ring-inset ring-dts-maroon/25",
  },
  carrier_rep: {
    label: "Carrier rep",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  other: {
    label: "Other",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
  },
};

/** The four record types a contact can be attached to. */
export const CONTACT_ATTACHMENTS = [
  { key: "show_id", param: "show", label: "Show", path: "shows" },
  { key: "exhibitor_id", param: "exhibitor", label: "Exhibitor", path: "exhibitors" },
  { key: "venue_id", param: "venue", label: "Venue", path: "venues" },
  { key: "carrier_id", param: "carrier", label: "Carrier", path: "carriers" },
] as const;
