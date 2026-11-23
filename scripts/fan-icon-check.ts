/**
 * ファンアイコンの保存判定。Firestore には接続しない。
 * 実行: npx tsx scripts/fan-icon-check.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSupporterCard } from '@/lib/fanManagement';
import {
  FAN_ICON_MAX_BYTES,
  canonicalFanIconUrl,
  inspectFanIcon,
  isSafeFanIconObject,
  parseOwnedFanIcon,
} from '@/lib/fanIcon';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const uid = 'fan12345';
const bucket = 'demo.appspot.com';
const file = '11111111-1111-4111-8111-111111111111';
const token = '22222222-2222-4222-8222-222222222222';
const objectPath = `fan-icons/${uid}/${file}.webp`;
const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert(inspectFanIcon('image/jpeg', jpeg).ok, 'JPEGを通す');
assert(inspectFanIcon('image/png', png).ok, 'PNGを通す');
assert(!inspectFanIcon('image/jpeg', png).ok, '形式と中身の不一致を拒否する');
assert(!inspectFanIcon('image/gif', jpeg).ok, 'GIFを拒否する');
assert(!inspectFanIcon('image/jpeg', new Uint8Array(FAN_ICON_MAX_BYTES + 1)).ok, '2MBを超える画像を拒否する');
assert(parseOwnedFanIcon(url, uid, bucket)?.objectPath === objectPath, '本人のfan-iconsだけ通す');
assert(canonicalFanIconUrl(url, uid, bucket) === url, '正規のURLを返す');
assert(canonicalFanIconUrl('https://example.com/a.webp', uid, bucket) === null, '外部URLを拒否する');
assert(parseOwnedFanIcon(url, 'other1234', bucket) === null, '他人のアイコンURLを拒否する');
assert(parseOwnedFanIcon(url.replace('.webp', '.jpg'), uid, bucket) === null, '変換前の拡張子を拒否する');
assert(!isSafeFanIconObject(uid, `fan-icons/${uid}/../photos/${file}.webp`), 'プロフィール写真のパスを拒否する');
assert(!isSafeFanIconObject(uid, `photos/${uid}/${file}.webp`), '公開写真フォルダを拒否する');

const card = buildSupporterCard(
  'creator1',
  { fanUid: uid, creatorUid: 'creator1', count: 2 },
  { accountKind: 'fan', fanName: 'ファン名', fanIconUrl: url, profile: { photos: [{ url: 'https://example.com/secret.jpg' }] } },
  { firstAt: null, lastAt: null },
  bucket
);
assert(card?.iconUrl === url && card.name === 'ファン名', 'ファン管理はファンアイコンだけ出す');
const foreign = buildSupporterCard(
  'creator1',
  { fanUid: uid, creatorUid: 'creator1', count: 2 },
  { accountKind: 'fan', fanName: 'ファン名', fanIconUrl: 'https://example.com/secret.jpg' },
  { firstAt: null, lastAt: null },
  bucket
);
assert(foreign?.iconUrl === null, '公開プロフィール写真のURLは出さない');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const route = readFileSync(join(root, 'app/api/fan-icon/route.ts'), 'utf8');
const deletion = readFileSync(join(root, 'app/lib/accountDeletion.ts'), 'utf8');
assert(route.includes('inspectFanIcon') && route.includes('encodeFanIcon'), 'サーバーで形式を確認して変換する');
assert(route.includes("readUserAccountKind") && route.includes('FAN_ACCOUNT_KIND'), 'ファン以外は拒否する');
assert(route.includes('resolveVerifiedSession'), 'セッションのUIDだけを使う');
assert(!route.includes('profile.photos') && !route.includes('uploadPhotos'), '公開プロフィール写真の処理は使わない');
assert(deletion.includes("'fan-icons'"), '退会時にファンアイコンも削除する');

const samplePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const { default: sharp } = await import('sharp');
const webp = await sharp(samplePng).resize(256, 256, { fit: 'cover' }).webp().toBuffer();
assert(webp.length > 12 && webp.subarray(0, 4).toString() === 'RIFF' && webp.subarray(8, 12).toString() === 'WEBP', '256pxのWebPに変換できる');

console.log('fan-icon-check ok');
