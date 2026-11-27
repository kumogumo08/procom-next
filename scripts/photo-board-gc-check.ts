/**
 * PHOTO BOARD の猶予削除判定と、管理者ロックの入口。
 * Storage も Firestore も触らない。
 * 実行: npx tsx scripts/photo-board-gc-check.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { canUsePhotoBoard } from '@/lib/photoBoardAccess';
import {
  canonicalPhotoBoardImageUrl,
  photoBoardGcAction,
  PHOTO_BOARD_FOLDER,
} from '@/lib/photoBoard';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const uid = 'board_user';
const bucketName = 'demo-bucket';
const fileId = '11111111-2222-4333-8444-555555555555';
const token = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const objectPath = `${PHOTO_BOARD_FOLDER}/${uid}/${fileId}.jpg`;
const imageUrl = canonicalPhotoBoardImageUrl(
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`,
  uid,
  bucketName
);
assert(imageUrl != null, '参照確認用の画像URLを作れない');

const saved = { items: [{ imageUrl }] };
assert(photoBoardGcAction(uid, objectPath, saved, bucketName) === 'referenced', '保存済み参照は消さない');
assert(photoBoardGcAction(uid, objectPath, { items: [] }, bucketName) === 'orphan', '未参照だけ削除候補');
assert(photoBoardGcAction(uid, objectPath, undefined, bucketName) === 'orphan', 'ボード未保存は未参照');
assert(
  photoBoardGcAction(uid, objectPath, { items: [{ imageUrl: 'https://evil.example/a.jpg' }] }, bucketName) ===
    'uncertain',
  '解釈できない保存済みURLは消さない'
);
assert(
  photoBoardGcAction(uid, `photos/${uid}/${fileId}.jpg`, undefined, bucketName) === 'unsafe',
  'プロフィール写真フォルダは対象外'
);
assert(
  photoBoardGcAction(uid, `${PHOTO_BOARD_FOLDER}/other/${fileId}.jpg`, undefined, bucketName) === 'unsafe',
  '他人のPHOTO BOARDは対象外'
);

const retentionMs = 2 * 60 * 60 * 1000;
const uploadedAt = 1_700_000_000_000;
assert(uploadedAt + retentionMs > uploadedAt, 'アップロード直後は期限前');

const photoGc = read('app/lib/photoGc.ts');
const imageRoute = read('app/api/photo-board/image/route.ts');
const userRoute = read('app/api/user/[uid]/route.ts');
const page = read('app/user/[uid]/page.tsx');
const deletion = read('app/lib/accountDeletion.ts');
const access = read('app/lib/photoBoardAccess.ts');

assert(
  photoGc.includes('export const PHOTO_RETENTION_MS = 2 * 60 * 60 * 1000'),
  '猶予は2時間'
);
assert(photoGc.includes('schedulePhotoBoardRetention'), 'アップロード時に猶予を記録する');
assert(photoGc.includes('deleteAfterMs: now + PHOTO_RETENTION_MS'), '期限は猶予のあと');
assert(photoGc.includes("where('deleteAfterMs', '<=', now)"), '期限前の予約は走査しない');
assert(photoGc.includes("objectPath.startsWith(`${PHOTO_BOARD_FOLDER}/`)"), '走査の削除分岐はPHOTO BOARDだけ');
assert(imageRoute.includes('schedulePhotoBoardRetention(uid, objectPath)'), '画像APIが猶予を記録する');
assert(imageRoute.includes('if (!canUsePhotoBoard(session.uid))'), '画像APIはサーバー側で権限を見る');
assert(userRoute.includes('if (!canUsePhotoBoard(sessionUid))'), '保存APIはサーバー側で権限を見る');
assert(userRoute.includes('photoBoardForSave = existingProfile.photoBoard'), '非管理者の保存は既存ボードを残す');
assert(userRoute.includes('includePhotoBoardForViewer'), '取得APIは権限のある本人だけ返す');
assert(page.includes('const photoBoardEnabled = isEditable && canUsePhotoBoard(loggedInUid)'), '表示は本人かつ権限');
assert(page.includes('hidePhotoBoard'), '公開ページの初期データからボードを外す');
assert(deletion.includes("deleteOwnedStoragePrefix(uid, 'photo-board')"), '退会時のフォルダ削除は維持');
assert(access.includes('return isAdmin(uid ?? undefined)'), '権限は既存の管理者判定だけ');
assert(!access.includes('isAdmin:') && !access.includes('body.isAdmin'), 'クライアントの管理者フラグは見ない');

const previousAdminUids = process.env.ADMIN_UIDS;
process.env.ADMIN_UIDS = 'gc-check-admin';
try {
  assert(canUsePhotoBoard('gc-check-admin'), '管理者は使える');
  assert(!canUsePhotoBoard('gc-check-user'), '非管理者は使えない');
  assert(!canUsePhotoBoard(null), '未ログインは使えない');
} finally {
  if (previousAdminUids === undefined) delete process.env.ADMIN_UIDS;
  else process.env.ADMIN_UIDS = previousAdminUids;
}

console.log('photo-board-gc-check ok');
