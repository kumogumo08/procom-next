/**
 * 商品ギャラリー。外部HTMLやスクリプトは受け取らない。
 * 画像URLは、このサーバーのバケットで本人の product-gallery/{uid}/ 直下だけを許す。
 */

export const MAX_PRODUCT_GALLERY_ITEMS = 5;
export const PRODUCT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const MISSING_PRODUCT_IMAGE_MESSAGE = '商品画像が見つかりません。もう一度選択してください';
export const PRODUCT_GALLERY_FOLDER = 'product-gallery';
export const PRODUCT_IMAGE_HOST = 'firebasestorage.googleapis.com';

const MAX_NAME = 120;
const MAX_PRICE = 40;
const MAX_URL = 2000;
export const MAX_SHOP_DESCRIPTION = 150;
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ProductGalleryItem = {
  id: string;
  name: string;
  productUrl: string;
  imageUrl: string;
  price?: string;
  displayOrder: number;
};

export type ProductGalleryResult =
  | { ok: true; items: ProductGalleryItem[] }
  | { ok: false; error: string };

export type ProductGallerySettings = {
  description: string;
  shopUrl: string;
};

export type ProductGallerySettingsResult =
  | { ok: true; settings?: ProductGallerySettings }
  | { ok: false; error: string };

export function browserStorageBucket(): string {
  const fromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return 'procom-fea80.firebasestorage.app';
}

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function looksLikeImage(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (contentType === 'image/webp') {
    if (bytes.length < 12) return false;
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return riff === 'RIFF' && webp === 'WEBP';
  }
  return false;
}

/** 宣言された形式と先頭バイト、3MB以下だけを通す。 */
export function inspectProductImage(
  contentType: unknown,
  bytes: Uint8Array
): { ok: true; ext: 'jpg' | 'png' | 'webp'; contentType: string } | { ok: false; error: string } {
  if (typeof contentType !== 'string' || !IMAGE_TYPES[contentType]) {
    return { ok: false, error: '画像はJPEG、PNG、WebPにしてください' };
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, error: 'ファイルサイズが大きすぎます（3MB以下にしてください）' };
  }
  if (!looksLikeImage(contentType, bytes)) {
    return { ok: false, error: '画像の形式を確認できませんでした' };
  }
  return { ok: true, ext: IMAGE_TYPES[contentType], contentType };
}

/** 販売ページは https のみ。javascript: や data: は URL として解釈できても拒否する。 */
export function isSafeProductUrl(raw: unknown): boolean {
  const value = trimStr(raw);
  if (!value || value.length > MAX_URL) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (!url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.')) return false;
  return true;
}

/** ショップURL。商品URLに加え、443以外のポートを拒否する。 */
export function isSafeShopUrl(raw: unknown): boolean {
  if (!isSafeProductUrl(raw)) return false;
  try {
    const url = new URL(trimStr(raw));
    return url.port === '' || url.port === '443';
  } catch {
    return false;
  }
}

export function shopDescriptionLength(value: string): number {
  return Array.from(value).length;
}

function normalizeShopDescription(raw: unknown): { ok: true; value: string } | { ok: false } {
  if (raw == null || raw === '') return { ok: true, value: '' };
  if (typeof raw !== 'string') return { ok: false };
  const value = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (shopDescriptionLength(value) > MAX_SHOP_DESCRIPTION) return { ok: false };
  return { ok: true, value };
}

function emptyShopSettings(description: string, shopUrl: string): ProductGallerySettings | undefined {
  if (!description && !shopUrl) return undefined;
  return { description, shopUrl };
}

/** 保存時。空ならフィールド自体を作らない。長すぎる紹介文と危険なURLは拒否する。 */
export function sanitizeProductGallerySettings(raw: unknown): ProductGallerySettingsResult {
  if (raw == null) return { ok: true };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'ショップ紹介を確認してください' };
  }
  const record = raw as Record<string, unknown>;
  const description = normalizeShopDescription(record.description);
  if (!description.ok) {
    return { ok: false, error: 'ショップ紹介文は150文字以内で入力してください' };
  }
  const shopUrl = trimStr(record.shopUrl);
  if (shopUrl && !isSafeShopUrl(shopUrl)) {
    return { ok: false, error: 'ショップURLはhttpsのリンクにしてください' };
  }
  return { ok: true, settings: emptyShopSettings(description.value, shopUrl) };
}

/** 表示用。壊れた紹介文は150文字で切り、危険なURLは空にする。 */
export function coerceProductGallerySettings(raw: unknown): ProductGallerySettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  let description = '';
  if (typeof record.description === 'string') {
    const normalized = record.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    description = Array.from(normalized).slice(0, MAX_SHOP_DESCRIPTION).join('');
  }
  const shopUrl = trimStr(record.shopUrl);
  return emptyShopSettings(description, isSafeShopUrl(shopUrl) ? shopUrl : '');
}

/** 商品が無くても、紹介文か安全なショップURLがあれば公開する。 */
export function shopIntroVisible(settings: ProductGallerySettings | undefined): boolean {
  if (!settings) return false;
  return settings.description.trim().length > 0 || isSafeShopUrl(settings.shopUrl);
}

export function parseOwnedProductImage(
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
  if (url.hostname !== PRODUCT_IMAGE_HOST) return null;
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
  if (segments.length !== 3 || segments[0] !== PRODUCT_GALLERY_FOLDER || segments[1] !== uid) return null;
  const file = segments[2];
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = file.slice(dot + 1).toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return null;
  if (!FILE_ID.test(file.slice(0, dot))) return null;
  return { objectPath, token };
}

export function canonicalProductImageUrl(rawUrl: unknown, uid: string, bucketName: string): string | null {
  const parsed = parseOwnedProductImage(rawUrl, uid, bucketName);
  if (!parsed) return null;
  return `https://${PRODUCT_IMAGE_HOST}/v0/b/${bucketName}/o/${encodeURIComponent(parsed.objectPath)}?alt=media&token=${parsed.token}`;
}

/** 保存済みパス。URLを再解釈せず、本人の product-gallery/{uid}/ 直下だけを許す。 */
export function isSafeProductGalleryObject(uid: unknown, objectPath: unknown): objectPath is string {
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
  if (segments.length !== 3 || segments[0] !== PRODUCT_GALLERY_FOLDER || segments[1] !== uid) return false;
  const file = segments[2];
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return false;
  const ext = file.slice(dot + 1).toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) && FILE_ID.test(file.slice(0, dot));
}

export function productImagePaths(raw: unknown, uid: string, bucketName: string): string[] {
  if (!Array.isArray(raw)) return [];
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const parsed = parseOwnedProductImage((item as { imageUrl?: unknown }).imageUrl, uid, bucketName);
    if (!parsed || seen.has(parsed.objectPath)) continue;
    seen.add(parsed.objectPath);
    paths.push(parsed.objectPath);
  }
  return paths;
}

/** 保存後に消してよい本人の画像。他ユーザー、他フォルダ、まだ参照中のパスは含めない。 */
export function removedProductImagePaths(
  before: unknown,
  after: unknown,
  uid: string,
  bucketName: string
): string[] {
  const keep = new Set(productImagePaths(after, uid, bucketName));
  return productImagePaths(before, uid, bucketName).filter(
    (objectPath) => isSafeProductGalleryObject(uid, objectPath) && !keep.has(objectPath)
  );
}

function blankItem(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const record = input as Record<string, unknown>;
  return !trimStr(record.name) && !trimStr(record.productUrl) && !trimStr(record.imageUrl) && !trimStr(record.price);
}

function readItem(
  input: unknown,
  uid: string,
  bucketName: string,
  index: number
): { ok: true; item: ProductGalleryItem } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '商品の内容を確認してください' };
  }
  const record = input as Record<string, unknown>;
  const name = trimStr(record.name).slice(0, MAX_NAME);
  if (!name) return { ok: false, error: '商品名を入力してください' };
  const productUrl = trimStr(record.productUrl);
  if (!isSafeProductUrl(productUrl)) {
    return { ok: false, error: `「${name}」のURLはhttpsのリンクにしてください` };
  }
  const imageUrl = canonicalProductImageUrl(record.imageUrl, uid, bucketName);
  if (!imageUrl) return { ok: false, error: `「${name}」の画像を確認できません` };
  const priceRaw = trimStr(record.price);
  if (priceRaw.length > MAX_PRICE) {
    return { ok: false, error: `「${name}」の価格は${MAX_PRICE}文字以内で入力してください` };
  }
  const requestedId = trimStr(record.id);
  const id = SAFE_ID.test(requestedId) ? requestedId : crypto.randomUUID();
  const item: ProductGalleryItem = {
    id,
    name,
    productUrl,
    imageUrl,
    displayOrder: index,
    ...(priceRaw ? { price: priceRaw } : {}),
  };
  return { ok: true, item };
}

/** 保存時。空行は落とす。欠けた行は保存しない。 */
export function sanitizeProductGallery(raw: unknown, uid: string, bucketName: string): ProductGalleryResult {
  if (raw == null) return { ok: true, items: [] };
  if (!Array.isArray(raw)) return { ok: false, error: '商品の内容を確認してください' };
  const filled = raw.filter((item) => !blankItem(item));
  if (filled.length > MAX_PRODUCT_GALLERY_ITEMS) {
    return { ok: false, error: '商品は最大5件までです' };
  }
  const items: ProductGalleryItem[] = [];
  for (let index = 0; index < filled.length; index += 1) {
    const read = readItem(filled[index], uid, bucketName, index);
    if (!read.ok) return read;
    items.push({ ...read.item, displayOrder: index });
  }
  return { ok: true, items };
}

/** 表示用。壊れた行は出さない。件数は5件で切る。 */
export function coerceProductGallery(raw: unknown, uid: string, bucketName: string): ProductGalleryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ProductGalleryItem[] = [];
  for (const item of raw) {
    if (blankItem(item)) continue;
    const read = readItem(item, uid, bucketName, items.length);
    if (!read.ok) continue;
    items.push(read.item);
    if (items.length >= MAX_PRODUCT_GALLERY_ITEMS) break;
  }
  return items.map((item, index) => ({ ...item, displayOrder: index }));
}

/** 削除した商品のタブ位置を引き継ぐ。別商品を見ているときはその選択を残す。 */
export function productTabAfterDelete(
  ids: readonly string[],
  removedId: string,
  selectedId: string | null
): string | null {
  const next = ids.filter((id) => id !== removedId);
  if (selectedId && selectedId !== removedId && next.includes(selectedId)) return selectedId;
  const index = ids.indexOf(removedId);
  if (index < 0 || next.length === 0) return null;
  return next[Math.min(index, next.length - 1)] ?? null;
}

/** 横スクロールの表示位置。はみ出していなければバーを出さない。 */
export function productScrollIndicator(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number
): { width: number; offset: number } | null {
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(scrollWidth) || !Number.isFinite(clientWidth)) return null;
  if (scrollWidth <= 0 || clientWidth <= 0) return null;
  const max = scrollWidth - clientWidth;
  if (max <= 1) return null;
  const width = (clientWidth / scrollWidth) * 100;
  const offset = (Math.min(max, Math.max(0, scrollLeft)) / max) * (100 - width);
  return { width, offset };
}

export function moveProductGalleryItem(
  items: readonly ProductGalleryItem[],
  id: string,
  direction: -1 | 1
): ProductGalleryItem[] {
  const next = items.map((item) => ({ ...item }));
  const index = next.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) {
    return next.map((item, order) => ({ ...item, displayOrder: order }));
  }
  const [item] = next.splice(index, 1);
  if (!item) return next.map((entry, order) => ({ ...entry, displayOrder: order }));
  next.splice(target, 0, item);
  return next.map((entry, order) => ({ ...entry, displayOrder: order }));
}

export function productGalleryContentEqual(
  a: readonly ProductGalleryItem[],
  b: readonly ProductGalleryItem[]
): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (JSON.stringify(a[index]) !== JSON.stringify(b[index])) return false;
  }
  return true;
}
