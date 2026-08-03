/**
 * Path: lib/move-out/types.ts
 * Plain types + constants for the move-out form, kept free of @react-pdf/renderer
 * so the client-side editor can import them without pulling the PDF renderer
 * into the browser bundle. MoveOutForm.tsx (server/PDF) re-exports these.
 */

export interface Party {
  company: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  attn?: string;
  specialInstructions?: string;
}

export type LevelOfService = "ground" | "1day" | "2day" | "deferred" | "specialized";

export interface MoveOutShipment {
  showName: string;
  booth?: string;
  exhibitorCompany: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;

  // SHIP TO = the consignee on the load
  shipTo: Party;

  // BILL TO = defaults to DTS; can be overridden per carrier profile or load
  billTo?: Party;

  // Carrier (prints under "Other Carrier")
  carrier: { name: string; phone?: string };

  levelOfService?: LevelOfService;

  accessorials?: {
    loadingDock?: boolean;
    insideDelivery?: boolean;
    liftgate?: boolean;
    residential?: boolean;
    padWrap?: boolean;
    doNotStack?: boolean;
    airRide?: boolean;
  };

  // Free-text lines (e.g. "Call before delivery") -> SPECIAL INSTRUCTIONS
  extraInstructions?: string[];

  numberOfLabels?: number;
}

/** Default bill-to. Overridable per carrier profile / per load. */
export const DTS_BILL_TO: Party = {
  company: "Diversified Transportation Services",
  address1: "19829 Hamilton Avenue",
  city: "Torrance",
  state: "CA",
  zip: "90502",
};

/** Level-of-service options in display order (value + label for form + PDF). */
export const LEVEL_OF_SERVICE_OPTIONS: { value: LevelOfService; label: string }[] = [
  { value: "ground", label: "Standard Ground" },
  { value: "1day", label: "1 Day: next business day" },
  { value: "2day", label: "2 Day: by 5:00 PM second business day" },
  { value: "deferred", label: "Deferred: 3-5 business days" },
  { value: "specialized", label: "Specialized: pad wrapped / uncrated / TL" },
];

/** Accessorial checkboxes in display order (key + label). */
export const ACCESSORIAL_FIELDS: {
  key: keyof NonNullable<MoveOutShipment["accessorials"]>;
  label: string;
}[] = [
  { key: "loadingDock", label: "Have loading dock" },
  { key: "insideDelivery", label: "Inside delivery" },
  { key: "liftgate", label: "Lift gate required" },
  { key: "residential", label: "Residential" },
  { key: "padWrap", label: "Pad wrap required" },
  { key: "doNotStack", label: "Do not stack" },
  { key: "airRide", label: "Air ride required" },
];

const strOrUndef = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
};

function coerceParty(v: unknown): Party {
  const p = (v ?? {}) as Record<string, unknown>;
  return {
    company: strOrUndef(p.company) ?? "",
    address1: strOrUndef(p.address1) ?? "",
    address2: strOrUndef(p.address2),
    city: strOrUndef(p.city) ?? "",
    state: strOrUndef(p.state) ?? "",
    zip: strOrUndef(p.zip) ?? "",
    phone: strOrUndef(p.phone),
    attn: strOrUndef(p.attn),
    specialInstructions: strOrUndef(p.specialInstructions),
  };
}

/**
 * Sanitize an untrusted JSON body (from the edit form) into a MoveOutShipment.
 * Everything is coerced to the right type so a malformed payload can't crash
 * the PDF renderer — the output is just text the user is printing for themselves.
 */
export function coerceMoveOutShipment(raw: unknown): MoveOutShipment {
  const r = (raw ?? {}) as Record<string, unknown>;
  const acc = (r.accessorials ?? {}) as Record<string, unknown>;
  const carrier = (r.carrier ?? {}) as Record<string, unknown>;
  const losValues = LEVEL_OF_SERVICE_OPTIONS.map((o) => o.value) as string[];
  const los = losValues.includes(String(r.levelOfService))
    ? (r.levelOfService as LevelOfService)
    : "ground";
  const labels = Number(r.numberOfLabels);

  return {
    showName: strOrUndef(r.showName) ?? "",
    booth: strOrUndef(r.booth),
    exhibitorCompany: strOrUndef(r.exhibitorCompany) ?? "",
    contactName: strOrUndef(r.contactName),
    contactPhone: strOrUndef(r.contactPhone),
    contactEmail: strOrUndef(r.contactEmail),
    shipTo: coerceParty(r.shipTo),
    billTo: r.billTo ? coerceParty(r.billTo) : undefined,
    carrier: { name: strOrUndef(carrier.name) ?? "", phone: strOrUndef(carrier.phone) },
    levelOfService: los,
    accessorials: {
      loadingDock: !!acc.loadingDock,
      insideDelivery: !!acc.insideDelivery,
      liftgate: !!acc.liftgate,
      residential: !!acc.residential,
      padWrap: !!acc.padWrap,
      doNotStack: !!acc.doNotStack,
      airRide: !!acc.airRide,
    },
    extraInstructions: Array.isArray(r.extraInstructions)
      ? (r.extraInstructions.map((x) => strOrUndef(x)).filter(Boolean) as string[])
      : [],
    numberOfLabels: Number.isFinite(labels) && labels > 0 ? Math.floor(labels) : undefined,
  };
}
