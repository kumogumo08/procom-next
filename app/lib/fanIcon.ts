/**
 * ファンアイコン。公開プロフィール写真とは別の fan-icons/{uid}/ だけを許す。
 */

export const FAN_ICON_MAX_BYTES = 2 * 1024 * 1024;
export const FAN_ICON_SIZE = 256;
export const FAN_ICON_FOLDER = 'fan-icons';
export const FAN_ICON_HOST = 'firebasestorage.googleapis.com';

const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function looksLikeImage(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (contentType === 'image/webp') {
    if (bytes.length < 12) return false;
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return riff === 'RIFF' && webp === 'WEBP';
  }
  return false;
}

/** 宣言された形式と先頭バイト、2MB以下だけを通す。 */
export function inspectFanIcon(
  contentType: unknown,
  bytes: Uint8Array
): { ok: true; contentType: string } | { ok: false; error: string } {
  if (typeof contentType !== 'string' || !IMAGE_TYPES[contentType]) {
    return { ok: false, error: '画像はJPEG、PNG、WebPにしてください' };
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > FAN_ICON_MAX_BYTES) {
    return { ok: false, error: '画像は2MB以下にしてください' };
  }
  if (!looksLikeImage(contentType, bytes)) {
    return { ok: false, error: '画像の形式を確認できませんでした' };
  }
  return { ok: true, contentType };
}

export function isSafeFanIconObject(uid: unknown, objectPath: unknown): objectPath is string {
  if (typeof uid !== 'string' || typeof objectPath !== 'string') return false;
  if (!SAFE_UID.test(uid)) return false;
  if (
    !objectPath ||
    objectPath.includes('\\') ||
    objectPath.includes('..') ||
    objectPath.includes('\0') ||
    objectPath.includes('%')
  ) {
    return false;
  }
  const segments = objectPath.split('/');
  if (segments.length !== 3 || segments[0] !== FAN_ICON_FOLDER || segments[1] !== uid) return false;
  const file = segments[2];
  const dot = file.lastIndexOf('.');
  if (dot <= 0 || file.slice(dot + 1).toLowerCase() !== 'webp') return false;
  return FILE_ID.test(file.slice(0, dot));
}

/** 本人の fan-icons/{uid}/{uuid}.webp だけ。それ以外は未設定として扱う。 */
export function parseOwnedFanIcon(
  rawUrl: unknown,
  uid: string,
  bucketName: string
): { objectPath: string; token: string } | null {
  if (!SAFE_UID.test(uid) || typeof bucketName !== 'string' || bucketName.length === 0) return null;
  if (typeof rawUrl !== 'string') return null;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (url.hostname !== FAN_ICON_HOST) return null;
  if (url.searchParams.get('alt') !== 'media') return null;
  const token = url.searchParams.get('token') ?? '';
  if (!TOKEN.test(token)) return null;
  const parts = url.pathname.split('/');
  if (parts.length < 6 || parts[1] !== 'v0' || parts[2] !== 'b' || parts[4] !== 'o') return null;
  if (parts[3] !== bucketName) return null;
  let objectPath = '';
  try {
    objectPath = decodeURIComponent(parts.slice(5).join('/'));
  } catch {
    return null;
  }
  if (!isSafeFanIconObject(uid, objectPath)) return null;
  return { objectPath, token };
}

export function canonicalFanIconUrl(rawUrl: unknown, uid: string, bucketName: string): string | null {
  const parsed = parseOwnedFanIcon(rawUrl, uid, bucketName);
  if (!parsed) return null;
  return `https://${FAN_ICON_HOST}/v0/b/${bucketName}/o/${encodeURIComponent(parsed.objectPath)}?alt=media&token=${parsed.token}`;
}

export function buildFanIconUrl(bucketName: string, objectPath: string, token: string): string {
  return `https://${FAN_ICON_HOST}/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}
