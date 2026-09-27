import { TIMEZONES } from "@/lib/logistics";

/**
 * The exhibitor kit reader: Claude reads a show's kit and DRAFTS the freight
 * details for a coordinator to check. Spec rule: AI drafts, a human verifies,
 * always. Nothing in here saves anything, and nothing here can mark a row
 * verified - the reader fills the form, the coordinator reads it against the
 * kit, and only their Save draft / Verify touches the database.
 *
 * Kept free of the SDK so the parsing and comparison rules can be tested.
 */

/** Fields on the Show page tab the reader may fill. dts_public_notes is ours, never the kit's. */
export const KIT_LOGISTICS_FIELDS = [
  "timezone",
  "advance_cutoff_local",
  "direct_cutoff_local",
  "carrier_check_in_cutoff_local",
  "advance_late_surcharge_note",
  "targeted_move_in",
  "targeted_move_in_note",
  "marshalling_yard_note",
  "label_requirements_note",
  "gsc_url",
] as const;
export type KitLogisticsField = (typeof KIT_LOGISTICS_FIELDS)[number];

/** Facts the kit states that live on the Overview tab. Compared, never written. */
export const KIT_SHOW_FACTS = [
  "show_start_date",
  "show_end_date",
  "move_in_start",
  "move_in_end",
  "move_out_start",
  "move_out_end",
  "advance_warehouse_open",
  "advance_warehouse_cutoff",
  "advance_warehouse_address",
  "direct_to_show_start",
  "direct_to_show_end",
  "direct_to_show_address",
  "marshalling_yard_address",
  "decorator",
] as const;
export type KitShowFact = (typeof KIT_SHOW_FACTS)[number];

export const FIELD_LABELS: Record<KitLogisticsField | KitShowFact, string> = {
  timezone: "Timezone",
  advance_cutoff_local: "Advance warehouse cut-off time",
  direct_cutoff_local: "Direct-to-show cut-off time",
  carrier_check_in_cutoff_local: "Carrier check-in cut-off time",
  advance_late_surcharge_note: "Late surcharge note",
  targeted_move_in: "Targeted move-in",
  targeted_move_in_note: "Targeted move-in note",
  marshalling_yard_note: "Marshalling yard note",
  label_requirements_note: "Labelling requirements",
  gsc_url: "GSC exhibitor services URL",
  show_start_date: "Show opens",
  show_end_date: "Show closes",
  move_in_start: "Move-in starts",
  move_in_end: "Move-in ends",
  move_out_start: "Move-out starts",
  move_out_end: "Move-out ends",
  advance_warehouse_open: "Advance warehouse opens",
  advance_warehouse_cutoff: "Advance warehouse deadline",
  advance_warehouse_address: "Advance warehouse address",
  direct_to_show_start: "Direct-to-show receiving starts",
  direct_to_show_end: "Direct-to-show receiving ends",
  direct_to_show_address: "Direct-to-show address",
  marshalling_yard_address: "Marshalling yard address",
  decorator: "General service contractor",
};

const DATE_FACTS = new Set<KitShowFact>([
  "show_start_date",
  "show_end_date",
  "move_in_start",
  "move_in_end",
  "move_out_start",
  "move_out_end",
  "advance_warehouse_open",
  "advance_warehouse_cutoff",
  "direct_to_show_start",
  "direct_to_show_end",
]);

/** One value the kit gave, and where in the kit to check it. */
export type KitValue = { value: string; where: string };

export type KitReading = {
  logistics: Partial<Record<KitLogisticsField, KitValue>>;
  facts: Partial<Record<KitShowFact, KitValue>>;
  /** Things the reader noticed that need a person: conflicts, a kit for another year. */
  warnings: string[];
  /** The year the kit is for, as the kit states it, or "" if it never says. */
  kit_year: string;
};

/**
 * Structured-output schema: a flat list of what the kit states. It was one
 * required {value, where} object per field (24 of them), and the API refused
 * that as too large a grammar to compile. A list with the field name as a
 * plain string compiles small; parseKitReading drops any name it doesn't know.
 */
export const KIT_SCHEMA = {
  type: "object",
  properties: {
    kit_year: { type: "string" },
    found: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          value: { type: "string" },
          where: { type: "string" },
        },
        required: ["field", "value", "where"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["kit_year", "found", "warnings"],
  additionalProperties: false,
} as const;

export const KIT_SYSTEM_PROMPT = `You read trade show exhibitor kits (exhibitor manuals, shipping and material handling pages, "Quick Facts" sheets) for Diversified Transportation Services, a freight broker that books exhibitor freight to and from shows. A coordinator will check every value you give against the kit before anything is published, so accuracy and honesty about gaps matter far more than filling every field.

Rules:
- found: one entry per field the kit actually states, with "field" set to one of these names exactly: ${[...KIT_LOGISTICS_FIELDS, ...KIT_SHOW_FACTS].join(", ")}. Leave a field out entirely if the kit does not say. Never guess, never fill from general knowledge of the show or venue, never carry over a prior year.
- For every entry, "where" says where in the kit to check it: page number or section heading, plus a short quote of at most 20 words. The coordinator uses it to find the line.
- Dates: YYYY-MM-DD. Times: 24-hour HH:MM, local to the show.
- timezone: one of ${TIMEZONES.map((t) => t.value).join(", ")} - the zone of the show city. Give it only if the kit names the city or venue; "where" should point at that.
- advance_cutoff_local / direct_cutoff_local / carrier_check_in_cutoff_local: only the time of day the kit gives for that deadline. The date goes in facts.
- targeted_move_in: "yes" if exhibitors get assigned move-in windows (targeted move-in, target dates, scheduled move-in), "no" if the kit says move-in is open, otherwise "".
- Notes (advance_late_surcharge_note, targeted_move_in_note, marshalling_yard_note, label_requirements_note): one or two short sentences a freight person would write to an exhibitor. Put the facts in your own words; do not copy the kit's sentences. No sales language.
- gsc_url: the general service contractor's exhibitor services or online ordering URL, if printed.
- Addresses in facts: one line, "Name, C/O agent, street, city, state zip" as printed. Leave out placeholder lines like "Exhibiting Company Name / Booth #".
- decorator: the general service contractor (for example Freeman, GES), as named.
- kit_year: the year the kit is for, as it states it.
- warnings: short notes for the coordinator about anything they need to look at - two deadlines that disagree, a kit that looks like a different year, a section that was cut off or unreadable. Empty list if none.`;

/** Coerce the model's JSON into a KitReading, dropping empty and malformed values. */
export function parseKitReading(raw: unknown): KitReading | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pick = <K extends string>(src: unknown, keys: readonly K[]) => {
    const out: Partial<Record<K, KitValue>> = {};
    if (!src || typeof src !== "object") return out;
    for (const k of keys) {
      const v = (src as Record<string, unknown>)[k] as { value?: unknown; where?: unknown } | undefined;
      const value = typeof v?.value === "string" ? v.value.trim() : "";
      if (!value) continue;
      out[k] = { value, where: typeof v?.where === "string" ? v.where.trim() : "" };
    }
    return out;
  };
  // The flat list the schema asks for, folded back into logistics and facts.
  // (A nested reading - the shape before the schema was flattened - still parses.)
  let logSrc: unknown = r.logistics;
  let factSrc: unknown = r.facts;
  if (Array.isArray(r.found)) {
    const byField: Record<string, { value: unknown; where: unknown }> = {};
    for (const f of r.found as { field?: unknown; value?: unknown; where?: unknown }[]) {
      if (!f || typeof f.field !== "string") continue;
      const key = f.field.trim();
      // First mention wins; a repeat is usually the same line quoted twice.
      if (!byField[key] && typeof f.value === "string" && f.value.trim()) byField[key] = { value: f.value, where: f.where };
    }
    logSrc = byField;
    factSrc = byField;
  }
  const logistics = pick(logSrc, KIT_LOGISTICS_FIELDS);
  const facts = pick(factSrc, KIT_SHOW_FACTS);

  // Drop anything the form or the database would refuse rather than half-fill it.
  if (logistics.timezone && !TIMEZONES.some((t) => t.value === logistics.timezone!.value)) {
    delete logistics.timezone;
  }
  for (const k of ["advance_cutoff_local", "direct_cutoff_local", "carrier_check_in_cutoff_local"] as const) {
    const t = logistics[k] && normalizeTime(logistics[k]!.value);
    if (t) logistics[k]!.value = t;
    else delete logistics[k];
  }
  if (logistics.targeted_move_in) {
    const v = logistics.targeted_move_in.value.toLowerCase();
    if (v === "yes" || v === "no") logistics.targeted_move_in.value = v;
    else delete logistics.targeted_move_in;
  }
  if (logistics.gsc_url && !/^https?:\/\//i.test(logistics.gsc_url.value)) {
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(logistics.gsc_url.value)) {
      logistics.gsc_url.value = `https://${logistics.gsc_url.value}`;
    } else {
      delete logistics.gsc_url;
    }
  }
  for (const k of KIT_SHOW_FACTS) {
    if (DATE_FACTS.has(k) && facts[k] && !/^\d{4}-\d{2}-\d{2}$/.test(facts[k]!.value)) delete facts[k];
  }

  const warnings = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === "string" && w.trim() !== "").map((w) => w.trim())
    : [];
  const kit_year = typeof r.kit_year === "string" ? r.kit_year.trim() : "";
  return { logistics, facts, warnings, kit_year };
}

/** "3:30 PM", "15:30", "1530" -> "15:30"; anything else -> null. */
export function normalizeTime(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2}):?(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.toLowerCase();
  if (ampm === "p" && h < 12) h += 12;
  if (ampm === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Strip a web page to readable text: scripts, styles and tags out, links kept. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Only public web addresses. The server fetches what a user types, so refuse
 * anything that points back inside a network.
 */
export function isFetchableUrl(input: string): boolean {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":")) return false; // bare IPs: a kit is never served from one
  return h.includes(".");
}

export type FactCheck = {
  field: KitShowFact;
  label: string;
  kit: string;
  where: string;
  crm: string | null;
  /** same: agrees; differs: the CRM has something else; missing: the CRM has nothing. */
  status: "same" | "differs" | "missing";
};

const squash = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Line the kit's facts up against what the Overview tab holds. Addresses are
 * compared loosely (the kit's formatting never matches ours); dates exactly.
 */
export function compareFacts(
  facts: KitReading["facts"],
  crm: Partial<Record<KitShowFact, string | null>>,
): FactCheck[] {
  const out: FactCheck[] = [];
  for (const field of KIT_SHOW_FACTS) {
    const k = facts[field];
    if (!k) continue;
    const have = crm[field]?.trim() || null;
    let status: FactCheck["status"];
    if (!have) status = "missing";
    else if (DATE_FACTS.has(field)) status = have.slice(0, 10) === k.value ? "same" : "differs";
    else {
      const a = squash(have);
      const b = squash(k.value);
      status = a && b && (a.includes(b) || b.includes(a) || sameDock(have, k.value)) ? "same" : "differs";
    }
    out.push({ field, label: FIELD_LABELS[field], kit: k.value, where: k.where, crm: have, status });
  }
  return out;
}

/**
 * Same street number and same ZIP is the same dock, however the kit spells
 * "Ave" or orders the C/O line. Addresses with no street number never match
 * this way - they fall back to the text comparison.
 */
function sameDock(a: string, b: string): boolean {
  const street = (s: string) => s.match(/(?:^|[\s,])(\d{1,6})\s+[A-Za-z]/)?.[1] ?? null;
  const zip = (s: string) => s.match(/\b(\d{5})(?:-\d{4})?\s*(?:,?\s*(?:USA?|United States))?\s*$/)?.[1] ?? null;
  const [sa, sb] = [street(a), street(b)];
  if (!sa || sa !== sb) return false;
  const [za, zb] = [zip(a), zip(b)];
  return !za || !zb || za === zb;
}
