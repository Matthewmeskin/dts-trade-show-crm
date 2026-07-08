/**
 * Turn an uploaded MHA file into something the model can read.
 *
 * Claude ingests JPEG/PNG/WebP/GIF as image blocks and PDFs natively as
 * document blocks, so we do NOT rasterize PDFs ourselves. HEIC (the iPhone
 * default) is the one format the API can't take, so we convert it to JPEG.
 */
import convert from "heic-convert";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
export const LOW_RES_LONGEST_EDGE = 1200;

/** Private bucket that holds uploaded MHA files. Signed-URL access only. */
export const MHA_UPLOADS_BUCKET = "mha-uploads";

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/pdf",
] as const;

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type PreparedMedia =
  | { kind: "image"; mediaType: ImageMediaType; base64: string }
  | { kind: "pdf"; mediaType: "application/pdf"; base64: string };

export function isAcceptedMime(mime: string): boolean {
  return (ACCEPTED_MIME as readonly string[]).includes(mime);
}

function isHeic(mime: string, filename: string): boolean {
  return (
    mime === "image/heic" ||
    mime === "image/heif" ||
    /\.hei[cf]$/i.test(filename)
  );
}

/**
 * Best-effort longest-edge in pixels for PNG/JPEG/WebP, used only for the
 * low-resolution warning. Returns null when it can't be determined (never
 * blocks a submission). Pure header parsing — no native image libraries.
 */
export function imageLongestEdge(buf: Buffer, mediaType: string): number | null {
  try {
    if (mediaType === "image/png" && buf.length >= 24 && buf.toString("ascii", 12, 16) === "IHDR") {
      return Math.max(buf.readUInt32BE(16), buf.readUInt32BE(20));
    }
    if (mediaType === "image/jpeg") {
      let o = 2;
      while (o + 9 < buf.length) {
        if (buf[o] !== 0xff) {
          o++;
          continue;
        }
        const marker = buf[o + 1];
        // SOF markers carry the frame dimensions.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const height = buf.readUInt16BE(o + 5);
          const width = buf.readUInt16BE(o + 7);
          return Math.max(width, height);
        }
        o += 2 + buf.readUInt16BE(o + 2);
      }
    }
    if (mediaType === "image/webp" && buf.length >= 30 && buf.toString("ascii", 12, 16) === "VP8X") {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return Math.max(w, h);
    }
  } catch {
    // fall through
  }
  return null;
}

export type PreparedResult = {
  media: PreparedMedia;
  /** The exact bytes to upload (post-conversion) and their MIME/size. */
  storedBuffer: Buffer;
  storedMime: string;
  storedBytes: number;
  lowResolution: boolean;
};

/**
 * Validate, convert if needed, and produce the model-ready payload plus the
 * metadata we store. Throws a user-facing Error on unsupported type / oversize.
 */
export async function prepareMedia(
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<PreparedResult> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("That file is larger than 15 MB. Please upload a smaller photo or PDF.");
  }

  if (mime === "application/pdf" || /\.pdf$/i.test(filename)) {
    return {
      media: { kind: "pdf", mediaType: "application/pdf", base64: buffer.toString("base64") },
      storedBuffer: buffer,
      storedMime: "application/pdf",
      storedBytes: buffer.length,
      lowResolution: false,
    };
  }

  if (isHeic(mime, filename)) {
    const converted = Buffer.from(await convert({ buffer, format: "JPEG", quality: 0.92 }));
    return {
      media: { kind: "image", mediaType: "image/jpeg", base64: converted.toString("base64") },
      storedBuffer: converted,
      storedMime: "image/jpeg",
      storedBytes: converted.length,
      lowResolution: (imageLongestEdge(converted, "image/jpeg") ?? Infinity) < LOW_RES_LONGEST_EDGE,
    };
  }

  const imageTypes: Record<string, ImageMediaType> = {
    "image/jpeg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
  };
  const mediaType = imageTypes[mime];
  if (!mediaType) {
    throw new Error("Unsupported file type. Upload a JPEG, PNG, HEIC, WebP, or PDF.");
  }

  return {
    media: { kind: "image", mediaType, base64: buffer.toString("base64") },
    storedBuffer: buffer,
    storedMime: mediaType,
    storedBytes: buffer.length,
    lowResolution: (imageLongestEdge(buffer, mediaType) ?? Infinity) < LOW_RES_LONGEST_EDGE,
  };
}
