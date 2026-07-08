import type { Enums } from "@/lib/database.types";

export type DocumentType = Enums<"document_type">;

export const DOCUMENT_TYPE_META: Record<
  DocumentType,
  { label: string; badge: string }
> = {
  exhibitor_kit: {
    label: "Exhibitor kit",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
  },
  routing_guide: {
    label: "Routing guide",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  floor_map: {
    label: "Floor map",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  advance_warehouse_form: {
    label: "Advance warehouse form",
    badge: "bg-dts-maroon/10 text-dts-maroon ring-1 ring-inset ring-dts-maroon/25",
  },
  other: {
    label: "Other",
    badge: "bg-dts-midgrey/10 text-dts-midgrey ring-1 ring-inset ring-dts-midgrey/30",
  },
  MHA: {
    label: "MHA",
    badge: "bg-dts-blue/10 text-dts-blue ring-1 ring-inset ring-dts-blue/25",
  },
};

export const DOCUMENTS_BUCKET = "documents";
