/**
 * マイページのお気に入りと応援履歴。Firestore には接続しない。
 * 回数は supportLinks.count だけを見る。
 */
import { isPublicListingEligible } from '@/lib/accountSuspension';

export const MYPAGE_LIST_LIMIT = 50;

const UID_PATTERN = /^[A-Za-z0-9]{1,128}$/;

export type MypageCreatorCard = {
  uid: string;
  name: string;
  photoUrl: string;
};

export type MypageSupportCard = MypageCreatorCard & {
  count: number;
  lastAt: Date | null;
};

export function selectOwnTargetIds(
  ownerUid: string,
  raw: unknown,
  limit = MYPAGE_LIST_LIMIT
): { ids: string[]; truncated: boolean } {
  if (!Array.isArray(raw)) return { ids: [], truncated: false };
  const ids: string[] = [];
  const seen = new Set<string>();
  let truncated = false;
  for (const item of raw) {
    if (typeof item !== 'string' || !UID_PATTERN.test(item) || item === ownerUid || seen.has(item)) continue;
    if (ids.length >= limit) {
      truncated = true;
      break;
    }
    seen.add(item);
    ids.push(item);
  }
  return { ids, truncated };
}

export function readOwnSupportLink(
  ownerUid: string,
  input: { fanUid: unknown; creatorUid: unknown; count: unknown }
): { creatorUid: string; count: number } | null {
  if (input.fanUid !== ownerUid) return null;
  if (typeof input.creatorUid !== 'string' || !UID_PATTERN.test(input.creatorUid) || input.creatorUid === ownerUid) {
    return null;
  }
  if (typeof input.count !== 'number' || !Number.isFinite(input.count) || input.count < 1) return null;
  return { creatorUid: input.creatorUid, count: Math.floor(input.count) };
}

function profilePhoto(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return '';
  const photos = (profile as { photos?: unknown }).photos;
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const first = photos[0];
  const url =
    typeof first === 'string'
      ? first
      : first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string'
        ? (first as { url: string }).url
        : '';
  const trimmed = url.trim();
  return trimmed.startsWith('https://') ? trimmed : '';
}

function profileName(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return '名前未設定';
  const name = (profile as { name?: unknown }).name;
  if (typeof name !== 'string' || !name.trim()) return '名前未設定';
  return name.trim();
}

/** 公開できる相手だけ名前と画像を返す。退会・停止・非公開は null。 */
export function visibleCreatorCard(uid: string, data: unknown): MypageCreatorCard | null {
  if (!UID_PATTERN.test(uid) || !isPublicListingEligible(data)) return null;
  const profile = (data as { profile?: unknown }).profile;
  return { uid, name: profileName(profile), photoUrl: profilePhoto(profile) };
}

export function sumSupportCounts(cards: readonly { count: number }[]): number {
  return cards.reduce((sum, card) => sum + card.count, 0);
}

export function formatTokyoDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}
