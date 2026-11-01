import 'server-only';

import { createHash } from 'crypto';

import { bucket, db } from '@/lib/firebase-admin';
import {
  isSafePhotoObject,
  ownedPhotoPathsFromPhotos,
  removedPhotoPaths,
  samePhotoPaths,
} from '@/lib/ownedPhotoPath';

const PHOTO_GC = 'photoGc';
const PUBLIC_PROFILES = 'publicProfiles';
const MISSING_PHOTO_MESSAGE = '画像が見つかりません。もう一度選択して保存してください';

/** Spotlight の 3600 秒と、TOP の再生成・stale を覆う猶予。 */
export const PHOTO_RETENTION_MS = 2 * 60 * 60 * 1000;
export const PHOTO_GC_SWEEP_LIMIT = 20;

export function photoGcId(uid: string, objectPath: string): string {
  return createHash('sha256').update(`${uid}\n${objectPath}`).digest('hex');
}

/**
 * 今回新たに参照する本人の画像が Storage に残っているか。
 * 既存プロフィールの URL は再確認しない。未保存のまま期限を過ぎて消えた URL は保存しない。
 */
export async function missingNewOwnedPhoto(
  uid: string,
  bucketName: string,
  beforePhotos: unknown,
  afterPhotos: unknown
): Promise<string | null> {
  const before = new Set(ownedPhotoPathsFromPhotos(beforePhotos, uid, bucketName));
  const after = ownedPhotoPathsFromPhotos(afterPhotos, uid, bucketName);
  for (const objectPath of after) {
    if (before.has(objectPath)) continue;
    const [found] = await bucket.file(objectPath).exists();
    if (!found) return MISSING_PHOTO_MESSAGE;
  }
  return null;
}

/** 未参照になってよいかは削除時にプロフィールを見て決める。ここは期限を書くだけ。 */
export async function schedulePhotoRetention(uid: string, objectPath: string, now = Date.now()): Promise<void> {
  if (!isSafePhotoObject(uid, objectPath)) {
    throw new Error('photo path rejected');
  }
  await db.collection(PHOTO_GC).doc(photoGcId(uid, objectPath)).set({
    uid,
    objectPath,
    deleteAfterMs: now + PHOTO_RETENTION_MS,
  });
}

/**
 * プロフィールから外れた本人の画像だけを猶予付きで記録する。
 * 参照中の画像の予約は消さない。並行保存が新しいファイルの予約を消すと、追跡できないため。
 * 失敗しても保存済みプロフィールは戻さない。
 */
export async function retainReplacedPhotos(
  uid: string,
  bucketName: string,
  beforePhotos: unknown,
  afterPhotos: unknown,
  now = Date.now()
): Promise<void> {
  try {
    const before = ownedPhotoPathsFromPhotos(beforePhotos, uid, bucketName);
    const after = ownedPhotoPathsFromPhotos(afterPhotos, uid, bucketName);
    if (samePhotoPaths(before, after)) return;
    const removed = removedPhotoPaths(before, after);
    await Promise.all(removed.map((objectPath) => schedulePhotoRetention(uid, objectPath, now)));
  } catch (err: unknown) {
    console.error('photo retention update failed:', err instanceof Error ? err.name : 'error');
  }
}

/**
 * 期限を過ぎた予約を最大20件。
 * 現在のプロフィールが参照しているオブジェクトは消さない。
 * 一覧同期から呼ぶ。失敗した1件は予約を残し、次の実行でやり直す。
 */
export async function sweepExpiredPhotos(
  now = Date.now()
): Promise<{ examined: number; deleted: number; kept: number }> {
  const snap = await db.collection(PHOTO_GC).where('deleteAfterMs', '<=', now).limit(PHOTO_GC_SWEEP_LIMIT).get();
  let deleted = 0;
  let kept = 0;
  const referencedCache = new Map<string, { profile: Set<string>; listing: Set<string> } | null>();

  for (const doc of snap.docs) {
    const data = doc.data();
    const uid = data.uid;
    const objectPath = data.objectPath;
    if (!isSafePhotoObject(uid, objectPath)) {
      await doc.ref.delete().catch(() => undefined);
      kept += 1;
      continue;
    }

    let referenced = referencedCache.get(uid);
    if (referenced === undefined) {
      try {
        const user = await db.collection('users').doc(uid).get();
        const listed = await db.collection(PUBLIC_PROFILES).doc(uid).get();
        const photos = user.exists ? user.get('profile.photos') : [];
        const listedUrl = listed.get('photoUrl');
        referenced = {
          profile: new Set(ownedPhotoPathsFromPhotos(photos, uid, bucket.name)),
          listing: new Set(
            ownedPhotoPathsFromPhotos(
              typeof listedUrl === 'string' && listedUrl ? [{ url: listedUrl }] : [],
              uid,
              bucket.name
            )
          ),
        };
        referencedCache.set(uid, referenced);
      } catch (err: unknown) {
        console.error('photo gc read failed:', err instanceof Error ? err.name : 'error');
        referencedCache.set(uid, null);
        continue;
      }
    }
    if (referenced == null) continue;

    if (referenced.profile.has(objectPath)) {
      await doc.ref.delete().catch(() => undefined);
      kept += 1;
      continue;
    }
    if (referenced.listing.has(objectPath)) {
      await doc.ref.update({ deleteAfterMs: now + PHOTO_RETENTION_MS }).catch(() => undefined);
      kept += 1;
      continue;
    }

    try {
      await bucket.file(objectPath).delete({ ignoreNotFound: true });
      await doc.ref.delete();
      deleted += 1;
    } catch (err: unknown) {
      console.error('photo gc delete failed:', err instanceof Error ? err.name : 'error');
    }
  }

  return { examined: snap.size, deleted, kept };
}
