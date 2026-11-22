import { randomUUID } from "node:crypto";
import exifReader from "exif-reader";
import sharp from "sharp";

// File upload checks (backlog 27b; reused by 27c). Server-only: called from
// server actions, never shipped to the browser.
//
// - The real type comes from the file's first bytes, never from its name or
//   the type the browser claims.
// - Images are re-encoded, which drops EXIF/XMP/IPTC metadata (camera, time,
//   GPS). Orientation is applied to the pixels first so photos stay upright.
// - Every file is stored under a random name; the original name is never kept.
// Limits match the private `evidence` bucket (migration 019).

import { EVIDENCE_BUCKET, MAX_UPLOAD_BYTES } from "./upload-limits";
export { EVIDENCE_BUCKET, MAX_UPLOAD_BYTES };

export type UploadKind = "pdf" | "jpeg" | "png" | "webp";

const CONTENT_TYPES: Record<UploadKind, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const EXTENSIONS: Record<UploadKind, string> = { pdf: "pdf", jpeg: "jpg", png: "png", webp: "webp" };

const startsWith = (b: Uint8Array, sig: number[], at = 0) =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

/** Identify the file from its first bytes. Anything else is refused. */
export function sniffFileType(b: Uint8Array): UploadKind | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "webp"; // RIFF....WEBP
  }
  return null;
}

/** A photo's GPS position, read before the metadata is stripped. PRIVATE. */
export type PhotoGps = { lat: number; lng: number };

export type PreparedUpload =
  | {
      ok: true;
      bytes: Buffer;
      contentType: string;
      kind: UploadKind;
      ext: string;
      /** GPS found in the original image (null if none). Never stored in the file. */
      gps: PhotoGps | null;
    }
  | { ok: false; error: "fileSize" | "fileType" | "fileRead" };

/** Check one uploaded file and return the bytes that may be stored. */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "fileSize" };
  const input = Buffer.from(await file.arrayBuffer());
  const kind = sniffFileType(input);
  if (!kind) return { ok: false, error: "fileType" };
  if (kind === "pdf") {
    // PDFs are stored as sent; their internal metadata isn't rewritten.
    return { ok: true, bytes: input, contentType: CONTENT_TYPES.pdf, kind, ext: EXTENSIONS.pdf, gps: null };
  }
  try {
    // sharp writes no metadata unless asked (no withMetadata()), so the
    // output carries no EXIF/GPS. limitInputPixels guards against huge images.
    const gps = await readPhotoGps(input);
    const img = sharp(input, { limitInputPixels: 50_000_000 }).rotate();
    const out =
      kind === "jpeg" ? img.jpeg({ quality: 88 }) : kind === "png" ? img.png() : img.webp({ quality: 88 });
    const bytes = await out.toBuffer();
    if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "fileSize" };
    return { ok: true, bytes, contentType: CONTENT_TYPES[kind], kind, ext: EXTENSIONS[kind], gps };
  } catch {
    return { ok: false, error: "fileRead" };
  }
}

/** Degrees/minutes/seconds + N/S/E/W reference to signed decimal degrees. */
function toDecimal(dms: unknown, ref: unknown, max: number): number | null {
  if (!Array.isArray(dms) || dms.length === 0) return null;
  const [d = 0, m = 0, s = 0] = dms.map(Number);
  if (![d, m, s].every(Number.isFinite)) return null;
  let v = d + m / 60 + s / 3600;
  if (ref === "S" || ref === "W") v = -v;
  v = Math.round(v * 1e6) / 1e6; // matches numeric(9, 6) in evidence_items
  return Math.abs(v) <= max ? v : null;
}

/**
 * Read GPS from an image's EXIF block (backlog 27c). Returns null when the
 * image has no usable position. The result is only ever offered for the
 * evidence item's PRIVATE gps fields; the stored file never carries it.
 */
export async function readPhotoGps(input: Buffer): Promise<PhotoGps | null> {
  try {
    const { exif } = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
    if (!exif) return null;
    const info = exifReader(exif).GPSInfo;
    if (!info) return null;
    const lat = toDecimal(info.GPSLatitude, info.GPSLatitudeRef, 90);
    const lng = toDecimal(info.GPSLongitude, info.GPSLongitudeRef, 180);
    if (lat === null || lng === null) return null;
    if (lat === 0 && lng === 0) return null; // "no fix" placeholder some cameras write
    return { lat, lng };
  } catch {
    return null;
  }
}

/** A random object name under a folder, e.g. documents/<uuid>.pdf. */
export function randomStoragePath(folder: "documents" | "evidence", ext: string) {
  return `${folder}/${randomUUID()}.${ext}`;
}
