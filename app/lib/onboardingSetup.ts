/**
 * 初期設定の保存計画。Firestore には書かない。
 * クライアントの onboardingStatus は受け取っても使わない。
 */
import { ONBOARDING_TEXT_MAX, readOnboardingGate } from '@/lib/onboarding';

export const SETUP_STORAGE_HOST = 'firebasestorage.googleapis.com';
export const SETUP_STORAGE_BUCKET = 'procom-fea80.firebasestorage.app';
export const SETUP_PHOTO_POSITION = 50;
export const SETUP_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const SAFE_UID = /^[A-Za-z0-9_-]{8,128}$/;
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type SetupWrite = {
  name?: string;
  title?: string;
  photos?: Array<{ url: string; position: number }>;
  onboardingStatus?: 'complete';
};

export type SetupPlan =
  | { ok: false; status: number; error: string; field?: 'name' | 'title' | 'photo' }
  | { ok: true; writes: SetupWrite };

export function resolveSetupUid(
  sessionUid: unknown,
  claimedUid: unknown
): { ok: true; uid: string } | { ok: false; status: 401 | 403; error: string } {
  if (typeof sessionUid !== 'string' || !SAFE_UID.test(sessionUid)) {
    return { ok: false, status: 401, error: 'ログインが必要です' };
  }
  if (claimedUid !== undefined && claimedUid !== null && claimedUid !== sessionUid) {
    return { ok: false, status: 403, error: '権限がありません' };
  }
  return { ok: true, uid: sessionUid };
}

export function readSetupText(
  value: unknown,
  label: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return { ok: false, error: `${label}を入力してください` };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: `${label}を入力してください` };
  if (trimmed.length > ONBOARDING_TEXT_MAX) {
    return { ok: false, error: `${label}は${ONBOARDING_TEXT_MAX}文字以内で入力してください` };
  }
  return { ok: true, value: trimmed };
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

export function inspectSetupImage(
  contentType: unknown,
  bytes: Uint8Array
): { ok: true; ext: string; contentType: string } | { ok: false; error: string } {
  if (typeof contentType !== 'string' || !IMAGE_TYPES[contentType]) {
    return { ok: false, error: '画像はJPEG、PNG、WebPにしてください' };
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > SETUP_IMAGE_MAX_BYTES) {
    return { ok: false, error: '画像は5MB以内にしてください' };
  }
  if (!looksLikeImage(contentType, bytes)) {
    return { ok: false, error: '画像の形式を確認できませんでした' };
  }
  return { ok: true, ext: IMAGE_TYPES[contentType], contentType };
}

/** URL文字列の前方一致では判定しない。ホスト、バケット、パスの各要素を照合する。 */
export function parseOwnedSetupPhoto(
  rawUrl: unknown,
  uid: string,
  bucketName: string
): { objectPath: string } | null {
  if (!SAFE_UID.test(uid) || typeof bucketName !== 'string' || bucketName.length === 0) return null;
  if (typeof rawUrl !== 'string') return null;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (url.hostname !== SETUP_STORAGE_HOST) return null;
  const parts = url.pathname.split('/');
  if (parts.length < 6 || parts[1] !== 'v0' || parts[2] !== 'b' || parts[4] !== 'o') return null;
  if (parts[3] !== bucketName) return null;
  let objectPath = '';
  try {
    objectPath = decodeURIComponent(parts.slice(5).join('/'));
  } catch {
    return null;
  }
  if (objectPath.includes('\\') || objectPath.includes('..') || objectPath.includes('\0') || objectPath.includes('%')) {
    return null;
  }
  const segments = objectPath.split('/');
  if (segments.length !== 3 || segments[0] !== 'photos' || segments[1] !== uid) return null;
  const file = segments[2];
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = file.slice(dot + 1).toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return null;
  if (!FILE_ID.test(file.slice(0, dot))) return null;
  return { objectPath };
}

export function buildSetupPhotoUrl(bucketName: string, objectPath: string, token: string): string | null {
  if (!TOKEN.test(token)) return null;
  if (objectPath.split('/').length !== 3) return null;
  return `https://${SETUP_STORAGE_HOST}/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export function acceptOwnedSetupPhoto(
  url: unknown,
  uid: string,
  bucketName: string,
  photoExists: boolean
): { ok: true; url: string } | { ok: false; error: string } {
  const parsed = parseOwnedSetupPhoto(url, uid, bucketName);
  if (!parsed || typeof url !== 'string') {
    return { ok: false, error: '本人のプロフィール画像だけを使えます' };
  }
  if (!photoExists) return { ok: false, error: 'プロフィール画像が見つかりません' };
  return { ok: true, url: url.trim() };
}

function rejectUnlessRequired(profile: unknown): SetupPlan | null {
  const gate = readOnboardingGate(profile);
  if (gate === 'complete') {
    return { ok: false, status: 409, error: '初期設定は完了しています' };
  }
  if (gate !== 'required') {
    return { ok: false, status: 403, error: '初期設定の対象ではありません' };
  }
  return null;
}

type DraftInput = {
  existingProfile: unknown;
  sessionUid: unknown;
  claimedUid: unknown;
  bucketName: string;
  nameProvided: boolean;
  titleProvided: boolean;
  photoProvided: boolean;
  name: unknown;
  title: unknown;
  photoUrl: unknown;
  photoExists: boolean;
};

export function planSetupDraft(input: DraftInput): SetupPlan {
  const auth = resolveSetupUid(input.sessionUid, input.claimedUid);
  if (!auth.ok) return auth;
  const blocked = rejectUnlessRequired(input.existingProfile);
  if (blocked) return blocked;
  if (!input.nameProvided && !input.titleProvided && !input.photoProvided) {
    return { ok: false, status: 400, error: '更新項目がありません' };
  }
  const writes: SetupWrite = {};
  if (input.nameProvided) {
    const name = readSetupText(input.name, '名前');
    if (!name.ok) return { ok: false, status: 400, error: name.error, field: 'name' };
    writes.name = name.value;
  }
  if (input.titleProvided) {
    const title = readSetupText(input.title, '肩書き');
    if (!title.ok) return { ok: false, status: 400, error: title.error, field: 'title' };
    writes.title = title.value;
  }
  if (input.photoProvided) {
    const photo = acceptOwnedSetupPhoto(input.photoUrl, auth.uid, input.bucketName, input.photoExists);
    if (!photo.ok) return { ok: false, status: 400, error: photo.error, field: 'photo' };
    writes.photos = [{ url: photo.url, position: SETUP_PHOTO_POSITION }];
  }
  return { ok: true, writes };
}

type CompleteInput = {
  existingProfile: unknown;
  sessionUid: unknown;
  claimedUid: unknown;
  bucketName: string;
  name: unknown;
  title: unknown;
  photoUrl: unknown;
  photoExists: boolean;
};

export function planSetupComplete(input: CompleteInput): SetupPlan {
  const auth = resolveSetupUid(input.sessionUid, input.claimedUid);
  if (!auth.ok) return auth;
  const blocked = rejectUnlessRequired(input.existingProfile);
  if (blocked) return blocked;
  const name = readSetupText(input.name, '名前');
  if (!name.ok) return { ok: false, status: 400, error: name.error, field: 'name' };
  const title = readSetupText(input.title, '肩書き');
  if (!title.ok) return { ok: false, status: 400, error: title.error, field: 'title' };
  const photo = acceptOwnedSetupPhoto(input.photoUrl, auth.uid, input.bucketName, input.photoExists);
  if (!photo.ok) return { ok: false, status: 400, error: photo.error, field: 'photo' };
  return {
    ok: true,
    writes: {
      name: name.value,
      title: title.value,
      photos: [{ url: photo.url, position: SETUP_PHOTO_POSITION }],
      onboardingStatus: 'complete',
    },
  };
}

export function applySetupWrites<T extends Record<string, unknown>>(profile: T, writes: SetupWrite): T {
  return { ...profile, ...writes };
}

export function setupFormInitial(profile: unknown): { name: string; title: string; photoUrl: string } {
  if (!profile || typeof profile !== 'object') return { name: '', title: '', photoUrl: '' };
  const source = profile as { name?: unknown; title?: unknown; photos?: unknown };
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const photos = Array.isArray(source.photos) ? source.photos : [];
  const first = photos[0];
  const photoUrl =
    typeof first === 'string'
      ? first.trim()
      : first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string'
        ? (first as { url: string }).url.trim()
        : '';
  return { name, title, photoUrl };
}
