/**
 * PHOTO BOARD の写真。
 * 画像URLは、このサーバーのバケットで本人の photo-board/{uid}/ 直下だけを許す。
 * 未保存のアップロードは猶予後に、保存済みプロフィールが参照していないものだけ消す。
 * photos/ など他フォルダは対象にしない。退会時は photo-board/{uid}/ をまとめて消す。
 */

export const MAX_PHOTO_BOARD_ITEMS = 10;
export const MAX_PHOTO_BOARD_MEMO = 25;
export const MAX_PHOTO_BOARD_MEMO_LINES = 2;
/** 以前の保存上限。これより長い既存メモは表示時に切らない。新規保存は25文字・改行1回まで。 */
const STORED_PHOTO_BOARD_MEMO = 100;
export const PHOTO_BOARD_FOLDER = 'photo-board';
export const MISSING_PHOTO_BOARD_IMAGE_MESSAGE = '写真が見つかりません。もう一度選択してください';

const PHOTO_BOARD_HOST = 'firebasestorage.googleapis.com';
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTS = ['jpg', 'jpeg', 'png', 'webp'];

export type PhotoBoardItem = {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  memo: string;
};

export const PHOTO_BOARD_THEMES = ['simple', 'cafe', 'natural', 'pink', 'blue', 'scrapbook', 'chalkboard'] as const;
export type PhotoBoardTheme = (typeof PHOTO_BOARD_THEMES)[number];

export type PhotoBoard = {
  items: PhotoBoardItem[];
  theme?: PhotoBoardTheme;
};

export type PhotoBoardResult = { ok: true; photoBoard: PhotoBoard } | { ok: false; error: string };

/** 追加時の初期位置。並びは固定で、空き枠の先頭から使う。 */
export const PHOTO_BOARD_SLOTS: readonly { x: number; y: number; rotation: number; zIndex: number }[] = [
  { x: 22, y: 30, rotation: -7, zIndex: 1 },
  { x: 46, y: 26, rotation: 5, zIndex: 3 },
  { x: 70, y: 30, rotation: -4, zIndex: 2 },
  { x: 30, y: 48, rotation: 4, zIndex: 5 },
  { x: 56, y: 46, rotation: -6, zIndex: 4 },
  { x: 78, y: 50, rotation: 3, zIndex: 6 },
  { x: 22, y: 68, rotation: -3, zIndex: 7 },
  { x: 46, y: 66, rotation: 6, zIndex: 9 },
  { x: 68, y: 70, rotation: -5, zIndex: 8 },
  { x: 40, y: 58, rotation: 2, zIndex: 10 },
];

export function nextPhotoBoardPlacement(
  items: readonly { x: number; y: number }[]
): { x: number; y: number; rotation: number; zIndex: number } | null {
  if (items.length >= MAX_PHOTO_BOARD_ITEMS) return null;
  const used = new Set(items.map((item) => `${item.x}:${item.y}`));
  return PHOTO_BOARD_SLOTS.find((slot) => !used.has(`${slot.x}:${slot.y}`)) ?? null;
}

export function samePhotoBoardItems(a: readonly PhotoBoardItem[], b: readonly PhotoBoardItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (
      left.id !== right.id ||
      left.imageUrl !== right.imageUrl ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.rotation !== right.rotation ||
      left.zIndex !== right.zIndex ||
      left.memo !== right.memo
    ) {
      return false;
    }
  }
  return true;
}

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readRatio(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped * 10) / 10;
}

/** 0度と360度は同じ向き。保存値は -180 から 180 まで。 */
function readRotation(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const wrapped = ((value % 360) + 360) % 360;
  const signed = wrapped > 180 ? wrapped - 360 : wrapped;
  return Math.round(signed * 10) / 10;
}

function readZIndex(value: unknown, fallback: number): number | null {
  const raw = value == null ? fallback : value;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const n = Math.trunc(raw);
  if (n < 0) return 0;
  if (n > 99) return 99;
  return n;
}

export function normalizePhotoBoardMemo(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** 合計25文字（改行も1文字）。明示的な改行は1回まで。行の幅では切らない。 */
export function isPhotoBoardMemoValid(value: string): boolean {
  if (value.length > MAX_PHOTO_BOARD_MEMO) return false;
  return value.split('\n').length <= MAX_PHOTO_BOARD_MEMO_LINES;
}

/** 3行目以降の改行だけ外し、25文字を超えた分だけ切る。 */
export function clampPhotoBoardMemo(value: string): string {
  const parts = normalizePhotoBoardMemo(value).split('\n');
  let memo = parts.length <= 1 ? (parts[0] ?? '') : `${parts[0]}\n${parts.slice(1).join('')}`;
  if (memo.length > MAX_PHOTO_BOARD_MEMO) memo = memo.slice(0, MAX_PHOTO_BOARD_MEMO);
  return memo;
}

/** ルール外の既存メモは、同じ内容か短くしたときだけ残す。 */
export function canKeepPhotoBoardMemo(kept: string, memo: string): boolean {
  if (memo === kept) return true;
  if (isPhotoBoardMemoValid(kept)) return false;
  return memo.length < kept.length && memo.split('\n').length <= kept.split('\n').length;
}

/** 入力欄と保存で同じ結果になるよう、新規は切り詰め、既存の超過分は崩さない。 */
export function limitPhotoBoardMemo(current: string, incoming: string): string {
  const next = normalizePhotoBoardMemo(incoming);
  const cur = normalizePhotoBoardMemo(current);
  if (isPhotoBoardMemoValid(next)) return next;
  if (canKeepPhotoBoardMemo(cur, next)) return next;
  if (isPhotoBoardMemoValid(cur)) return clampPhotoBoardMemo(next);
  return cur;
}

function readMemo(
  value: unknown,
  mode: 'save' | 'read',
  kept?: string | null
): { ok: true; memo: string } | { ok: false } {
  if (value == null || value === '') return { ok: true, memo: '' };
  if (typeof value !== 'string') return { ok: false };
  if (value.length > STORED_PHOTO_BOARD_MEMO * 16) return { ok: false };
  const memo = normalizePhotoBoardMemo(value).trim();
  if (memo.includes('\0')) return { ok: false };
  if (mode === 'read' || isPhotoBoardMemoValid(memo)) return { ok: true, memo };
  if (kept != null && canKeepPhotoBoardMemo(kept, memo)) return { ok: true, memo };
  return { ok: false };
}

function isPhotoBoardTheme(value: unknown): value is PhotoBoardTheme {
  return typeof value === 'string' && (PHOTO_BOARD_THEMES as readonly string[]).includes(value);
}

/** 未指定は従来のシンプル。保存時の不明な値は拒否し、表示時はシンプルに戻す。 */
function readTheme(raw: unknown, mode: 'save' | 'read'): { ok: true; theme?: PhotoBoardTheme } | { ok: false } {
  if (!raw || typeof raw !== 'object') return { ok: true };
  const value = (raw as { theme?: unknown }).theme;
  if (value == null || value === '') return { ok: true };
  if (isPhotoBoardTheme(value)) return { ok: true, theme: value };
  if (mode === 'read') return { ok: true, theme: 'simple' };
  return { ok: false };
}

function previousMemos(raw: unknown): Map<string, string> {
  const items = rawItems(raw);
  const memos = new Map<string, string>();
  if (!items) return memos;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = trimStr(record.id);
    if (!SAFE_ID.test(id) || memos.has(id)) continue;
    const memo = readMemo(record.memo, 'read');
    if (memo.ok) memos.set(id, memo.memo);
  }
  return memos;
}

export function parseOwnedPhotoBoardImage(
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
  if (url.hostname !== PHOTO_BOARD_HOST) return null;
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
  if (segments.length !== 3 || segments[0] !== PHOTO_BOARD_FOLDER || segments[1] !== uid) return null;
  const file = segments[2];
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = file.slice(dot + 1).toLowerCase();
  if (!EXTS.includes(ext)) return null;
  if (!FILE_ID.test(file.slice(0, dot))) return null;
  return { objectPath, token };
}

export function canonicalPhotoBoardImageUrl(rawUrl: unknown, uid: string, bucketName: string): string | null {
  const parsed = parseOwnedPhotoBoardImage(rawUrl, uid, bucketName);
  if (!parsed) return null;
  return `https://${PHOTO_BOARD_HOST}/v0/b/${bucketName}/o/${encodeURIComponent(parsed.objectPath)}?alt=media&token=${parsed.token}`;
}

/** 保存済みパス。URLを再解釈せず、本人の photo-board/{uid}/ 直下だけを許す。 */
export function isSafePhotoBoardObject(uid: unknown, objectPath: unknown): objectPath is string {
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
  if (segments.length !== 3 || segments[0] !== PHOTO_BOARD_FOLDER || segments[1] !== uid) return false;
  const file = segments[2];
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return false;
  const ext = file.slice(dot + 1).toLowerCase();
  return EXTS.includes(ext) && FILE_ID.test(file.slice(0, dot));
}

function rawItems(raw: unknown): unknown[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  return items;
}

export type PhotoBoardGcAction = 'unsafe' | 'referenced' | 'uncertain' | 'orphan';

/**
 * 猶予後の PHOTO BOARD 画像を消してよいか。
 * 参照中、または保存内容を解釈できないときは消さない。他フォルダは unsafe。
 */
export function photoBoardGcAction(
  uid: unknown,
  objectPath: unknown,
  photoBoard: unknown,
  bucketName: string
): PhotoBoardGcAction {
  if (typeof uid !== 'string' || !isSafePhotoBoardObject(uid, objectPath)) return 'unsafe';
  if (photoBoard == null) return 'orphan';
  if (typeof photoBoard !== 'object' || Array.isArray(photoBoard)) return 'uncertain';
  const items = (photoBoard as { items?: unknown }).items;
  if (!Array.isArray(items)) return 'uncertain';
  const referenced = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const imageUrl = (item as { imageUrl?: unknown }).imageUrl;
    if (typeof imageUrl !== 'string' || imageUrl.trim() === '') continue;
    const parsed = parseOwnedPhotoBoardImage(imageUrl, uid, bucketName);
    if (!parsed) return 'uncertain';
    referenced.add(parsed.objectPath);
  }
  return referenced.has(objectPath) ? 'referenced' : 'orphan';
}

export function photoBoardImagePaths(raw: unknown, uid: string, bucketName: string): string[] {
  const items = rawItems(raw);
  if (!items) return [];
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const parsed = parseOwnedPhotoBoardImage((item as { imageUrl?: unknown }).imageUrl, uid, bucketName);
    if (!parsed || seen.has(parsed.objectPath)) continue;
    seen.add(parsed.objectPath);
    paths.push(parsed.objectPath);
  }
  return paths;
}

/** 保存後に消してよい本人の画像。他フォルダと、まだ参照中のパスは含めない。 */
export function removedPhotoBoardImagePaths(
  before: unknown,
  after: unknown,
  uid: string,
  bucketName: string
): string[] {
  const keep = new Set(photoBoardImagePaths(after, uid, bucketName));
  return photoBoardImagePaths(before, uid, bucketName).filter(
    (objectPath) => isSafePhotoBoardObject(uid, objectPath) && !keep.has(objectPath)
  );
}

function readItem(
  input: unknown,
  uid: string,
  bucketName: string,
  index: number,
  mode: 'save' | 'read',
  usedIds: Set<string>,
  keptMemos?: Map<string, string>
): { ok: true; item: PhotoBoardItem } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '写真の内容を確認してください' };
  }
  const record = input as Record<string, unknown>;
  const imageUrl = canonicalPhotoBoardImageUrl(record.imageUrl, uid, bucketName);
  if (!imageUrl) return { ok: false, error: '写真の画像を確認できません' };
  const x = readRatio(record.x);
  const y = readRatio(record.y);
  if (x == null || y == null) return { ok: false, error: '写真の位置を確認してください' };
  const rotation = readRotation(record.rotation);
  if (rotation == null) return { ok: false, error: '写真の回転を確認してください' };
  const zIndex = readZIndex(record.zIndex, index);
  if (zIndex == null) return { ok: false, error: '写真の重なり順を確認してください' };
  const requestedId = trimStr(record.id);
  const memo = readMemo(record.memo, mode, keptMemos?.get(requestedId));
  if (!memo.ok) return { ok: false, error: `メモは${MAX_PHOTO_BOARD_MEMO_LINES}行、合計${MAX_PHOTO_BOARD_MEMO}文字以内で入力してください` };
  let id = SAFE_ID.test(requestedId) ? requestedId : crypto.randomUUID();
  if (usedIds.has(id)) id = crypto.randomUUID();
  usedIds.add(id);
  return { ok: true, item: { id, imageUrl, x, y, rotation, zIndex, memo: memo.memo } };
}

/** 保存時。null は明示的なクリア。形が違う値は拒否する。 */
export function sanitizePhotoBoard(
  raw: unknown,
  uid: string,
  bucketName: string,
  previous?: unknown
): PhotoBoardResult {
  if (raw == null) return { ok: true, photoBoard: { items: [] } };
  const theme = readTheme(raw, 'save');
  if (!theme.ok) return { ok: false, error: 'ボードデザインを確認してください' };
  const items = rawItems(raw);
  if (!items) return { ok: false, error: '写真の内容を確認してください' };
  if (items.length > MAX_PHOTO_BOARD_ITEMS) {
    return { ok: false, error: `写真は最大${MAX_PHOTO_BOARD_ITEMS}枚までです` };
  }
  const usedIds = new Set<string>();
  const keptMemos = previousMemos(previous);
  const next: PhotoBoardItem[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const read = readItem(items[index], uid, bucketName, index, 'save', usedIds, keptMemos);
    if (!read.ok) return read;
    next.push(read.item);
  }
  return { ok: true, photoBoard: theme.theme ? { items: next, theme: theme.theme } : { items: next } };
}

/** 表示用。壊れた行は出さない。件数は10枚で切る。 */
export function coercePhotoBoard(raw: unknown, uid: string, bucketName: string): PhotoBoard {
  const theme = readTheme(raw, 'read');
  const resolved = theme.ok && theme.theme ? theme.theme : 'simple';
  const items = rawItems(raw);
  if (!items) return { items: [], theme: resolved };
  const usedIds = new Set<string>();
  const next: PhotoBoardItem[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const read = readItem(items[index], uid, bucketName, next.length, 'read', usedIds);
    if (!read.ok) continue;
    next.push(read.item);
    if (next.length >= MAX_PHOTO_BOARD_ITEMS) break;
  }
  return { items: next, theme: resolved };
}
