/**
 * 「こんな人が使っています」の候補プールと 12 人抽選。
 * Firestore には触らない。時刻と乱数は引数で渡し、テストでは同じ結果を再現する。
 *
 * 1000 人規模への移行:
 * 取得側が画像あり公開ユーザーを最大 SPOTLIGHT_SOURCE_MAX 件まで読み、
 * ここで新規 30・更新 30・通常 30 に縮める。通常枠は作成日の新しい順で切らない。
 * 2000 件を超えたら全件読みをやめ、新規は sortAtMs、更新は contentUpdatedAtMs、
 * 通常はランダムキーの範囲クエリへこの関数の入力だけを差し替える。
 */

export const SPOTLIGHT_NEW_MS = 14 * 24 * 60 * 60 * 1000;
export const SPOTLIGHT_UPDATE_MS = 30 * 24 * 60 * 60 * 1000;
export const SPOTLIGHT_BAND = 4;
export const SPOTLIGHT_LIMIT = 12;
export const SPOTLIGHT_POOL_BAND = 30;
export const SPOTLIGHT_POOL_MAX = SPOTLIGHT_POOL_BAND * 3;
export const SPOTLIGHT_SOURCE_MAX = 2000;
export const SPOTLIGHT_SOURCE_REVALIDATE_SECONDS = 60 * 60;

export type SpotlightRng = () => number;

/** 現在の抽選は均等。推し数や完成度は後から重みに使える。 */
export type SpotlightSignals = {
  oshiCount?: number;
  completeness?: number;
};

export type SpotlightCandidate = {
  uid: string;
  name: string;
  title: string;
  photoUrl: string;
  createdAtMs: number | null;
  contentUpdatedAtMs: number | null;
  signals?: SpotlightSignals;
};

export type SpotlightSelection = {
  users: SpotlightCandidate[];
  featuredUid: string | null;
};

export function spotlightProfileHref(uid: string): string {
  return `/user/${uid}`;
}

export function spotlightHourSeed(nowMs: number): number {
  return Math.floor(nowMs / 3_600_000);
}

export function mulberry32(seed: number): SpotlightRng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toSpotlightCandidate(row: {
  uid: string;
  name?: string;
  title?: string;
  photoUrl?: string;
  createdAtMs?: number | null;
  contentUpdatedAtMs?: number | null;
  isPublic: boolean;
  signals?: SpotlightSignals;
}): SpotlightCandidate | null {
  const photoUrl = typeof row.photoUrl === 'string' ? row.photoUrl.trim() : '';
  if (!row.isPublic || !row.uid || !photoUrl) return null;
  return {
    uid: row.uid,
    name: typeof row.name === 'string' ? row.name : '',
    title: typeof row.title === 'string' ? row.title : '',
    photoUrl,
    createdAtMs: row.createdAtMs != null && row.createdAtMs > 0 ? row.createdAtMs : null,
    contentUpdatedAtMs: row.contentUpdatedAtMs != null && row.contentUpdatedAtMs > 0 ? row.contentUpdatedAtMs : null,
    ...(row.signals ? { signals: row.signals } : {}),
  };
}

function dedupe(candidates: readonly SpotlightCandidate[]): SpotlightCandidate[] {
  const seen = new Set<string>();
  const unique: SpotlightCandidate[] = [];
  for (const candidate of candidates) {
    const picked = toSpotlightCandidate({ ...candidate, isPublic: true });
    if (!picked || seen.has(picked.uid)) continue;
    seen.add(picked.uid);
    unique.push(picked);
  }
  return unique;
}

export function isNewSpotlight(candidate: SpotlightCandidate, nowMs: number): boolean {
  const created = candidate.createdAtMs;
  if (created == null || created <= 0 || created > nowMs) return false;
  return nowMs - created <= SPOTLIGHT_NEW_MS;
}

export function isUpdatedSpotlight(candidate: SpotlightCandidate, nowMs: number): boolean {
  if (isNewSpotlight(candidate, nowMs)) return false;
  const updated = candidate.contentUpdatedAtMs;
  if (updated == null || updated <= 0 || updated > nowMs) return false;
  return nowMs - updated <= SPOTLIGHT_UPDATE_MS;
}

function classify(candidates: readonly SpotlightCandidate[], nowMs: number) {
  const fresh: SpotlightCandidate[] = [];
  const updated: SpotlightCandidate[] = [];
  const regular: SpotlightCandidate[] = [];
  for (const candidate of candidates) {
    if (isNewSpotlight(candidate, nowMs)) fresh.push(candidate);
    else if (isUpdatedSpotlight(candidate, nowMs)) updated.push(candidate);
    else regular.push(candidate);
  }
  return { fresh, updated, regular };
}

function draw(items: readonly SpotlightCandidate[], count: number, rng: SpotlightRng): SpotlightCandidate[] {
  if (count <= 0 || items.length === 0) return [];
  const copy = [...items];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i += 1) {
    const span = copy.length - i;
    const offset = Math.floor(rng() * span);
    const j = i + (offset < 0 ? 0 : offset >= span ? span - 1 : offset);
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy.slice(0, n);
}

export function buildSpotlightPool(
  source: readonly SpotlightCandidate[],
  nowMs: number,
  rng: SpotlightRng
): SpotlightCandidate[] {
  const unique = dedupe(source);
  if (unique.length <= SPOTLIGHT_POOL_MAX) return unique;
  const bands = classify(unique, nowMs);
  return [
    ...draw(bands.fresh, SPOTLIGHT_POOL_BAND, rng),
    ...draw(bands.updated, SPOTLIGHT_POOL_BAND, rng),
    ...draw(bands.regular, SPOTLIGHT_POOL_BAND, rng),
  ];
}

export function selectSpotlight(
  source: readonly SpotlightCandidate[],
  nowMs: number,
  rng: SpotlightRng
): SpotlightSelection {
  const unique = dedupe(source);
  const bands = classify(unique, nowMs);
  const picked = [
    ...draw(bands.fresh, SPOTLIGHT_BAND, rng),
    ...draw(bands.updated, SPOTLIGHT_BAND, rng),
    ...draw(bands.regular, SPOTLIGHT_BAND, rng),
  ];
  const pickedIds = new Set(picked.map((item) => item.uid));
  const rest = unique.filter((item) => !pickedIds.has(item.uid));
  const need = Math.min(SPOTLIGHT_LIMIT, unique.length) - picked.length;
  if (need > 0) picked.push(...draw(rest, need, rng));
  const users = draw(picked, picked.length, rng);
  if (users.length === 0) return { users, featuredUid: null };
  const index = Math.min(users.length - 1, Math.floor(rng() * users.length));
  return { users, featuredUid: users[index]?.uid ?? null };
}
