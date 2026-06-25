/**
 * Fuzzy matching of free-text venue names (or messy shipping-label text) to an
 * existing venue record. Shared by the New Show import and the Suggestions page.
 */

export type VenueLite = { id: string; venue_name: string; city: string | null; state: string | null };

// Words too generic to distinguish one venue from another.
const STOPWORDS = new Set([
  "the", "convention", "center", "centre", "conv", "ctr", "expo", "exposition",
  "hall", "complex", "of", "and", "at", "fairgrounds", "fairground", "booth",
  "loading", "docks", "dock", "building", "north", "south", "east", "west",
]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => norm(s).split(" ").filter((t) => t && !STOPWORDS.has(t) && t.length > 1);

/**
 * Best-effort match of free text (a venue name from a doc, or a raw shipping
 * label like "McCormick Place: 2301 S Lake Shore Drive ... Booth #3727") to a
 * known venue. Tries exact → substring → distinctive-token containment.
 */
export function matchVenue(raw: string, venues: VenueLite[]): VenueLite | undefined {
  const candidates = [raw, raw.split(",")[0], raw.split(":")[0]]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const cand of candidates) {
    const cn = norm(cand);
    const exact = venues.find((v) => norm(v.venue_name) === cn);
    if (exact) return exact;
  }
  for (const cand of candidates) {
    const cn = norm(cand);
    if (!cn) continue;
    const sub = venues.find((v) => {
      const vn = norm(v.venue_name);
      return vn.length > 3 && (vn.includes(cn) || cn.includes(vn));
    });
    if (sub) return sub;
  }
  // Token overlap: all of the venue's distinctive tokens appear in the raw text.
  const rt = new Set(tokens(raw));
  if (rt.size) {
    const tok = venues.find((v) => {
      const vt = tokens(v.venue_name);
      return vt.length > 0 && vt.every((t) => rt.has(t));
    });
    if (tok) return tok;
  }
  return undefined;
}
