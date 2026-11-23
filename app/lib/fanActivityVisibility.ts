/**
 * 応援履歴の公開設定。true のときだけ公開。未設定とファンは非公開。
 */
import { FAN_ACCOUNT_KIND, readAccountKind } from '@/lib/accountKind';
import { isPublicListingEligible } from '@/lib/accountSuspension';

export const FAN_ACTIVITY_PUBLIC_FIELD = 'fanActivityPublic';

/** 明示的な true かつファン以外だけ公開。 */
export function isFanActivityPublic(accountKind: unknown, value: unknown): boolean {
  if (readAccountKind(accountKind) === FAN_ACCOUNT_KIND) return false;
  return value === true;
}

/** 公開設定に加え、停止・退会・未完成・非公開プロフィールは出さない。 */
export function canShowPublicFanActivity(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as { accountKind?: unknown; fanActivityPublic?: unknown };
  if (!isFanActivityPublic(record.accountKind, record.fanActivityPublic)) return false;
  return isPublicListingEligible(data);
}

export function parseFanActivityVisibility(
  body: unknown
): { ok: true; value: boolean } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || !Object.prototype.hasOwnProperty.call(body, 'public')) {
    return { ok: false, error: '公開設定を確認できません' };
  }
  const value = (body as { public?: unknown }).public;
  if (typeof value !== 'boolean') return { ok: false, error: '公開設定を確認できません' };
  return { ok: true, value };
}
