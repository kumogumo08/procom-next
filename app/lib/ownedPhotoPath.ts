const PHOTO_DOWNLOAD_HOST = 'firebasestorage.googleapis.com';

/**
 * 差し替えで削除してよいオブジェクト。
 * このサーバーのバケットで、本人の photos/{uid}/ 直下だけ。
 * 解釈できないURLは null。例外にはしない。
 */
export function ownedReplacementPhotoPath(rawUrl: unknown, uid: string, bucketName: string): string | null {
  if (typeof rawUrl !== 'string' || !uid || !bucketName) return null;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (url.hostname !== PHOTO_DOWNLOAD_HOST) return null;
  if (url.searchParams.get('alt') !== 'media') return null;
  const parts = url.pathname.split('/');
  if (parts.length < 6 || parts[1] !== 'v0' || parts[2] !== 'b' || parts[4] !== 'o') return null;
  if (parts[3] !== bucketName) return null;
  let objectPath = '';
  try {
    objectPath = decodeURIComponent(parts.slice(5).join('/'));
  } catch {
    return null;
  }
  if (
    !objectPath ||
    objectPath.includes('\\') ||
    objectPath.includes('..') ||
    objectPath.includes('\0') ||
    objectPath.includes('%')
  ) {
    return null;
  }
  const segments = objectPath.split('/');
  if (segments.length !== 3 || segments[0] !== 'photos' || segments[1] !== uid || !segments[2]) return null;
  return objectPath;
}

/** 保存済みパス。URLを再解釈せず、本人の photos/{uid}/ 直下だけを許す。 */
export function isSafePhotoObject(uid: unknown, objectPath: unknown): objectPath is string {
  if (typeof uid !== 'string' || typeof objectPath !== 'string') return false;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return false;
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
  return segments.length === 3 && segments[0] === 'photos' && segments[1] === uid && segments[2].length > 0;
}

export function firstPhotoUrl(photos: unknown): string {
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const first = photos[0];
  if (typeof first === 'string') return first.trim();
  if (first && typeof first === 'object' && 'url' in first) {
    const url = (first as { url?: unknown }).url;
    return typeof url === 'string' ? url.trim() : '';
  }
  return '';
}

/** 保存前後の先頭画像。クライアントが申告した旧URLは見ない。 */
export function listingPhotoChanged(beforePhotos: unknown, afterPhotos: unknown): boolean {
  return firstPhotoUrl(beforePhotos) !== firstPhotoUrl(afterPhotos);
}

export function ownedPhotoPathsFromPhotos(photos: unknown, uid: string, bucketName: string): string[] {
  if (!Array.isArray(photos)) return [];
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const item of photos) {
    const raw =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object'
          ? (item as { url?: unknown }).url
          : undefined;
    const objectPath = ownedReplacementPhotoPath(raw, uid, bucketName);
    if (!objectPath || seen.has(objectPath)) continue;
    seen.add(objectPath);
    paths.push(objectPath);
  }
  return paths;
}

export function samePhotoPaths(before: readonly string[], after: readonly string[]): boolean {
  if (before.length !== after.length) return false;
  const keep = new Set(after);
  return before.every((path) => keep.has(path));
}

export function removedPhotoPaths(before: readonly string[], after: readonly string[]): string[] {
  const keep = new Set(after);
  return before.filter((path) => !keep.has(path));
}
