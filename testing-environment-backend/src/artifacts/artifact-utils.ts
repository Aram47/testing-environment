import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export async function gzipBuffer(data: Buffer): Promise<Buffer> {
  return gzipAsync(data);
}

export async function gunzipBuffer(data: Buffer): Promise<Buffer> {
  return gunzipAsync(data);
}

export function toJsonBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value, null, 2), 'utf8');
}

export function truncateTextByBytes(
  text: string,
  limitBytes: number,
): { preview: string; truncated: boolean } {
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.byteLength <= limitBytes) {
    return { preview: text, truncated: false };
  }
  return { preview: buffer.subarray(0, limitBytes).toString('utf8'), truncated: true };
}

export function previewJson(
  value: unknown,
  limitBytes: number,
): { preview: unknown; truncated: boolean } {
  const text = JSON.stringify(value ?? null, null, 2);
  const truncated = truncateTextByBytes(text, limitBytes);
  if (!truncated.truncated) {
    return { preview: value ?? null, truncated: false };
  }
  return { preview: truncated.preview, truncated: true };
}

export function sanitizeArtifactKeySegment(
  value: string | undefined | null,
  fallback: string,
): string {
  const normalized = (value ?? '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  const trimmed = normalized.replace(/^_+|_+$/g, '');
  return trimmed || fallback;
}
