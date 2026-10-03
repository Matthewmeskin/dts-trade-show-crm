/**
 * The show's maps for a GSC Shipping Center show (ship_shows.floor_plan_url
 * and dock_map_url): a link to the organizer's online floor plan, or a file
 * from the exhibitor kit uploaded to Vercel Blob. Both are shown on a public
 * page, so https links only, as the database checks too. Pure (tested).
 */

export const MAP_KINDS = {
  floor_plan: { column: "floor_plan_url", label: "Floor plan", file: "floor-plan" },
  dock_map: { column: "dock_map_url", label: "Dock and marshalling yard map", file: "dock-map" },
} as const;

export type MapKind = keyof typeof MAP_KINDS;

/** What an uploaded map can be, and how big: a kit's PDF or an image of one page. */
export const MAP_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export const MAP_MAX_BYTES = 25 * 1024 * 1024;

const EXT: Record<(typeof MAP_UPLOAD_TYPES)[number], string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** The same rule as the database's check: https, no spaces or markup, at most 1,000 characters. */
export function validMapUrl(url: string): boolean {
  return url.length <= 1000 && /^https:\/\/[^\s<>"]+$/.test(url);
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Where an uploaded map is stored: one folder per GSC and show. Null for a type we don't take. */
export function mapPathname(partnerId: string, showId: string, kind: MapKind, contentType: string): string | null {
  const ext = EXT[contentType as keyof typeof EXT];
  if (!ext || !new RegExp(`^${UUID}$`).test(partnerId) || !new RegExp(`^${UUID}$`).test(showId)) return null;
  return `ship-maps/${partnerId}/${showId}/${MAP_KINDS[kind].file}.${ext}`;
}

/** The upload route only signs paths mapPathname could have made. */
export function validMapPathname(pathname: string): boolean {
  return new RegExp(`^ship-maps/${UUID}/${UUID}/(floor-plan|dock-map)\\.(pdf|png|jpg|webp)$`).test(pathname);
}
