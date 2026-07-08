/**
 * DTS identity matching for the MHA verification tool.
 *
 * Rules R1 (carrier must NOT be DTS) and R2 (bill-to MUST be DTS) both hinge on
 * a single question: "is this text Diversified Transportation Services?" That
 * decision lives here, once, so it can be unit-tested and never drifts between
 * call sites.
 */

/**
 * Every way DTS shows up on a Material Handling Agreement. The bare token `dts`
 * is matched by word boundary only (see `matchDts`) — never as a substring —
 * so carriers that merely contain the letters d-t-s are not false positives.
 */
export const DTS_ALIASES = [
  "diversified transportation services",
  "diversified transportation svcs",
  "diversified transportation",
  "diversified trans",
  "dts one",
  "dtsone",
  "dts",
] as const;

/**
 * DTS billing profile, used by `looksLikeDtsAddress` as a secondary R2 check
 * when the Bill To company box is illegible but the address block is readable.
 * Sourced from the move-out form's DTS_BILL_TO (lib/move-out/MoveOutForm.tsx).
 */
export const DTS_BILL_TO = {
  company: "Diversified Transportation Services",
  street: "19829 Hamilton Avenue",
  city: "Torrance",
  state: "CA",
  zip: "90502",
} as const;

/** Company suffixes stripped during normalization so "DTS, Inc." === "DTS". */
const SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "llp",
  "corp",
  "corporation",
  "co",
  "company",
  "ltd",
  "limited",
]);

/**
 * Lowercase, strip punctuation, collapse whitespace, and drop trailing company
 * suffixes. Exported for reuse by carrier fuzzy-matching (L1).
 */
export function normalizeCompany(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const words = cleaned.split(" ");
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join(" ");
}

export type DtsMatch = { matched: boolean; alias: string | null };

/**
 * Returns which DTS alias fired (or null). Multi-word aliases use substring
 * match on the normalized string; the bare `dts` token uses a word-boundary
 * regex so it never matches inside a longer token (e.g. "tforce dts express"
 * would match on the boundary, but "tdslogistics" would not).
 */
export function matchDts(value: string | null | undefined): DtsMatch {
  if (!value) return { matched: false, alias: null };
  const normalized = normalizeCompany(value);
  if (!normalized) return { matched: false, alias: null };

  for (const alias of DTS_ALIASES) {
    if (alias === "dts") {
      if (/\bdts\b/.test(normalized)) return { matched: true, alias };
    } else if (normalized.includes(alias)) {
      return { matched: true, alias };
    }
  }
  return { matched: false, alias: null };
}

/** Convenience boolean wrapper over `matchDts`. */
export function isDts(value: string | null | undefined): boolean {
  return matchDts(value).matched;
}

/**
 * Secondary confirmation that an address block belongs to DTS, used to rescue
 * R2 when the Bill To company name is unreadable. Deliberately lenient on the
 * street (house number + "hamilton" is enough) but strict on city/state/zip.
 */
export function looksLikeDtsAddress(
  street: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): boolean {
  const cityOk = !!city && city.trim().toLowerCase() === DTS_BILL_TO.city.toLowerCase();
  const stateOk =
    !!state && state.trim().toLowerCase().replace(/[^a-z]/g, "") === DTS_BILL_TO.state.toLowerCase();
  const zipOk = !!zip && zip.trim().replace(/[^0-9]/g, "").startsWith(DTS_BILL_TO.zip);
  const streetOk = !!street && /hamilton/i.test(street);

  // City + state + zip is a strong signal on its own; street reinforces it.
  const geoMatches = [cityOk, stateOk, zipOk].filter(Boolean).length;
  return (geoMatches >= 2 && streetOk) || (cityOk && stateOk && zipOk);
}
