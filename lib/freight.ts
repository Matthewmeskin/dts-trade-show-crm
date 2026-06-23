/**
 * Freight delivery addresses for a show are stored as separate parts (ship-to
 * name, C/O handling agent, street, city, state, zip, country) so labels can be
 * filled field-by-field. These helpers compose those parts into display lines
 * and a single-line string (for map links and the legacy *_address column).
 */

export type FreightAddressParts = {
  name?: string | null;
  care_of?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
};

/** Field suffixes that make up a freight address, in display order. */
export const FREIGHT_ADDRESS_KEYS = [
  "name",
  "care_of",
  "street1",
  "street2",
  "city",
  "state",
  "zip",
  "country",
] as const;

const clean = (v: string | null | undefined) => (v ?? "").trim();

/**
 * Build the address into display lines + a flattened one-line string.
 * City/State/ZIP collapse onto a single line ("Chula Vista, CA 91911").
 * Returns empty lines and a null oneLine when no parts are present.
 */
export function composeFreightAddress(p: FreightAddressParts): {
  lines: string[];
  oneLine: string | null;
} {
  const cityState = [clean(p.city), clean(p.state)].filter(Boolean).join(", ");
  const cityLine = [cityState, clean(p.zip)].filter(Boolean).join(" ").trim();

  const lines = [
    clean(p.name),
    clean(p.care_of),
    clean(p.street1),
    clean(p.street2),
    cityLine,
    clean(p.country),
  ].filter(Boolean);

  return { lines, oneLine: lines.length ? lines.join(", ") : null };
}
