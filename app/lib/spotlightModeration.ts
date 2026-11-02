/**
 * TOP の Spotlight だけを外すフラグ。
 * 未設定と false は掲載候補。true のときだけ除外する。
 * 一覧・検索・プロフィール・sitemap の条件には使わない。
 */

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** スキーム・ホスト・ポートまで含めた完全一致。ブラウザの Origin はこの形で届く。 */
const PRODUCTION_ORIGINS = new Set([
  'https://procom.jp',
  'https://www.procom.jp',
  'https://procom-next.onrender.com',
]);

/** `next dev` の既定ポートだけ。統合テストの 3100 番は管理 API を呼ばない。 */
const DEVELOPMENT_ORIGINS = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);

export function readUserSpotlightOff(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const moderation = (data as { moderation?: unknown }).moderation;
  if (!moderation || typeof moderation !== 'object' || Array.isArray(moderation)) return false;
  return (moderation as { spotlightOff?: unknown }).spotlightOff === true;
}

export function isSpotlightExcluded(value: unknown): boolean {
  return value === true;
}

/** true のときだけフィールドを足す。false の set ではフィールドを残さない。 */
export function assignSpotlightOff<T extends object>(payload: T, off: boolean): T | (T & { spotlightOff: true }) {
  if (!off) return payload;
  return { ...payload, spotlightOff: true };
}

export function isAdminTargetUid(uid: string): boolean {
  return UID_PATTERN.test(uid);
}

/** 本番は許可リストだけ。開発中だけ localhost の 3000 番を足す。無い Origin と null は拒否。 */
export function isTrustedOrigin(origin: string | null, dev: boolean): boolean {
  if (!origin || origin === 'null') return false;
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  return dev && DEVELOPMENT_ORIGINS.has(origin);
}

export function parseSpotlightPatch(body: unknown): boolean | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'spotlightOff') return null;
  return typeof record.spotlightOff === 'boolean' ? record.spotlightOff : null;
}

export type SpotlightPatchDecision =
  | { ok: false; status: 400 | 403; error: 'unauthorized' | 'bad-origin' | 'bad-request' }
  | { ok: true; spotlightOff: boolean };

/** 管理者・Origin・UID・入力の順。Firestore の存在確認は呼び出し側。 */
export function decideAdminSpotlightPatch(input: {
  isAdmin: boolean;
  origin: string | null;
  dev: boolean;
  uid: string;
  body: unknown;
}): SpotlightPatchDecision {
  if (!input.isAdmin) return { ok: false, status: 403, error: 'unauthorized' };
  if (!isTrustedOrigin(input.origin, input.dev)) {
    return { ok: false, status: 403, error: 'bad-origin' };
  }
  if (!isAdminTargetUid(input.uid)) return { ok: false, status: 400, error: 'bad-request' };
  const spotlightOff = parseSpotlightPatch(input.body);
  if (spotlightOff === null) return { ok: false, status: 400, error: 'bad-request' };
  return { ok: true, spotlightOff };
}
