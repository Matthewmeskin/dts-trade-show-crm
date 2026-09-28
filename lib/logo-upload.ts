import sharp from "sharp";

/**
 * A GSC's logo for its Shipping Center pages, emails and labels (spec section
 * 8): PNG, JPEG or WebP only, under 500 KB, then re-encoded here so whatever
 * came in (metadata, oddities, anything riding inside the file) is not what
 * gets served. Always stored as PNG, at most 600 x 240, so transparency
 * survives and email clients can show it.
 */
export const LOGO_MAX_BYTES = 500 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const FORMATS = new Set(["png", "jpeg", "webp"]);

export type LogoResult = { ok: true; png: Buffer; width: number; height: number } | { ok: false; error: string };

export async function processLogo(bytes: Buffer, declaredType: string): Promise<LogoResult> {
  if (!TYPES.has(declaredType)) return { ok: false, error: "Use a PNG, JPEG or WebP image." };
  if (bytes.length === 0) return { ok: false, error: "That file is empty." };
  if (bytes.length > LOGO_MAX_BYTES) return { ok: false, error: "Keep the logo under 500 KB." };
  try {
    // Trust the bytes, not the name or the browser's type.
    const meta = await sharp(bytes, { limitInputPixels: 4096 * 4096 }).metadata();
    if (!meta.format || !FORMATS.has(meta.format)) return { ok: false, error: "Use a PNG, JPEG or WebP image." };
    const { data, info } = await sharp(bytes, { limitInputPixels: 4096 * 4096 })
      .rotate()
      .resize({ width: 600, height: 240, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, png: data, width: info.width, height: info.height };
  } catch {
    return { ok: false, error: "That image could not be read. Try another file." };
  }
}

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
