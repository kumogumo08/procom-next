/**
 * クリエイター向けファン管理の表示判定。Firestore には接続しない。
 * 回数は supportLinks.count だけを見る。匿名応援は supportLinks に無い。
 */
import { mypageView } from '@/lib/accountKind';
import { readUserSuspended } from '@/lib/accountSuspension';
import { canonicalFanIconUrl } from '@/lib/fanIcon';

export const FAN_MANAGEMENT_LIMIT = 50;

/** 表示名とファンアイコン、除外判定に必要な項目だけ。公開プロフィール写真は取らない。 */
export const SUPPORTER_FIELDS = [
  'accountKind',
  'fanName',
  'fanIconUrl',
  'profile.name',
  'deletionPending',
  'moderation.suspended',
] as const;

const UID_PATTERN = /^[A-Za-z0-9]{1,128}$/;

export type FanManagementCard = {
  name: string;
  count: number;
  firstAt: Date | null;
  lastAt: Date | null;
  iconUrl: string | null;
};

/** 自分宛てのログイン済み応援だけ残す。creatorUid はセッション UID と一致が必要。 */
export function readCreatorSupportLink(
  ownerUid: string,
  input: { fanUid: unknown; creatorUid: unknown; count: unknown }
): { fanUid: string; count: number } | null {
  if (input.creatorUid !== ownerUid) return null;
  if (typeof input.fanUid !== 'string' || !UID_PATTERN.test(input.fanUid) || input.fanUid === ownerUid) {
    return null;
  }
  if (typeof input.count !== 'number' || !Number.isFinite(input.count) || input.count < 1) return null;
  return { fanUid: input.fanUid, count: Math.floor(input.count) };
}

/**
 * 応援者の表示名。ファンは fanName、それ以外は公開名。
 * 公開プロフィールが無くても名前は返す。退会・停止・文書なしは null。
 */
export function supporterDisplayName(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { deletionPending?: unknown; accountKind?: unknown; profile?: unknown; fanName?: unknown };
  if (record.deletionPending === true) return null;
  if (readUserSuspended(data)) return null;
  return mypageView(record.accountKind, record.profile, record.fanName).displayName;
}

export function buildSupporterCard(
  ownerUid: string,
  input: { fanUid: unknown; creatorUid: unknown; count: unknown },
  userData: unknown,
  dates: { firstAt: Date | null; lastAt: Date | null },
  bucketName = ''
): FanManagementCard | null {
  const link = readCreatorSupportLink(ownerUid, input);
  if (!link) return null;
  const name = supporterDisplayName(userData);
  if (!name) return null;
  const rawIcon =
    userData && typeof userData === 'object' ? (userData as { fanIconUrl?: unknown }).fanIconUrl : null;
  return {
    name,
    count: link.count,
    firstAt: dates.firstAt,
    lastAt: dates.lastAt,
    iconUrl: canonicalFanIconUrl(rawIcon, link.fanUid, bucketName),
  };
}
