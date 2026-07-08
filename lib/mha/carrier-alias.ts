/**
 * Carrier name matching for L1 (MHA carrier vs. the carrier booked on the load).
 * Freight carriers are written a dozen ways on show floors ("T-Force",
 * "TForce Freight", "UPS Freight"), so we normalize, expand a small alias map,
 * and fall back to a normalized Levenshtein ratio.
 */
import { normalizeCompany } from "./dts-identity";

/** Groups of names that all refer to the same carrier. */
const ALIAS_GROUPS: string[][] = [
  ["tforce", "tforce freight", "t force freight", "ups freight"],
  ["sefl", "southeastern freight lines", "southeastern"],
  ["fedex freight", "fedex", "fxf"],
  ["xpo", "xpo logistics", "con way", "conway"],
  ["odfl", "old dominion", "old dominion freight line"],
  ["r l carriers", "rl carriers", "rlc", "roadway"],
  ["abf", "abf freight", "arcbest"],
  ["yrc", "yellow", "yrc freight"],
  ["estes", "estes express", "estes express lines"],
  ["saia", "saia ltl", "saia motor freight"],
];

const ALIAS_INDEX: Map<string, number> = (() => {
  const m = new Map<string, number>();
  ALIAS_GROUPS.forEach((group, i) => {
    for (const name of group) m.set(normalizeCompany(name), i);
  });
  return m;
})();

/** Classic Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similarity in [0,1]: 1 - distance/maxLen. */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * True when two carrier names denote the same carrier. Alias-map hit wins
 * outright; otherwise a normalized Levenshtein ratio above 0.85.
 */
export function carriersMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ga = ALIAS_INDEX.get(na);
  const gb = ALIAS_INDEX.get(nb);
  if (ga !== undefined && ga === gb) return true;
  // One side is a known alias and the other contains its group's normalized form.
  if (ga !== undefined || gb !== undefined) {
    for (const group of ALIAS_GROUPS) {
      const inA = group.some((g) => na.includes(normalizeCompany(g)));
      const inB = group.some((g) => nb.includes(normalizeCompany(g)));
      if (inA && inB) return true;
    }
  }

  return similarity(na, nb) >= 0.85;
}
