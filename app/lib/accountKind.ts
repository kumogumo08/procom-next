/**
 * 会員種別。未設定の既存ユーザーは従来どおり。
 * ファンの表示名は fanName。公開プロフィール名は profile.name のまま。
 */

export const FAN_ACCOUNT_KIND = 'fan' as const;
export const CREATOR_ACCOUNT_KIND = 'creator' as const;
export const ACCOUNT_KIND_CLAIM = 'procomAccountKind';

/** 公開名の上限と同じ。 */
export const FAN_NAME_MAX = 48;

export type AccountKind = typeof FAN_ACCOUNT_KIND | typeof CREATOR_ACCOUNT_KIND;

const ACCOUNT_KIND_REQUIRED = 'ファンまたはクリエイターを選択してください';

export function readAccountKind(value: unknown): AccountKind | null {
  if (value === FAN_ACCOUNT_KIND || value === CREATOR_ACCOUNT_KIND) return value;
  return null;
}

export function readUserAccountKind(data: unknown): AccountKind | null {
  if (!data || typeof data !== 'object') return null;
  return readAccountKind((data as { accountKind?: unknown }).accountKind);
}

export function readFanName(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return { ok: false, error: '表示名を入力してください' };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: '表示名を入力してください' };
  if (trimmed.length > FAN_NAME_MAX) {
    return { ok: false, error: `表示名は${FAN_NAME_MAX}文字以内で入力してください` };
  }
  return { ok: true, value: trimmed };
}

/** 項目が無い、または fan / creator 以外は拒否する。 */
export function parseRegistrationAccountKind(
  body: object
): { ok: true; kind: AccountKind } | { ok: false; error: string } {
  if (!Object.prototype.hasOwnProperty.call(body, 'accountKind')) {
    return { ok: false, error: ACCOUNT_KIND_REQUIRED };
  }
  const kind = readAccountKind((body as { accountKind?: unknown }).accountKind);
  if (!kind) return { ok: false, error: ACCOUNT_KIND_REQUIRED };
  return { ok: true, kind };
}

/** 中断した登録の claim。無い場合は従来の復旧（種別を足さない）。 */
export function pendingAccountKind(claims: unknown): AccountKind | null {
  if (!claims || typeof claims !== 'object') return null;
  return readAccountKind((claims as Record<string, unknown>)[ACCOUNT_KIND_CLAIM]);
}

/** 公開名が自分以外に使われているか。 */
export function publicNameTakenByOther(ownerUid: string, matchedIds: readonly string[]): boolean {
  return matchedIds.some((id) => id !== ownerUid);
}

/**
 * セッション表示。公開名があればそれを使う。
 * 公開名が空のファンだけ fanName に戻す。既存ユーザーは profile.name のまま。
 */
export type MypageRole = 'fan' | 'creator';

export type MypageView = {
  role: MypageRole;
  roleLabel: string;
  displayName: string;
};

function trimmedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * マイページの表示。ファンは fanName、それ以外は公開名。
 * 種別が無い既存会員はクリエイターとして扱う。保存はしない。
 */
export function mypageView(accountKind: unknown, profile: unknown, fanName: unknown): MypageView {
  if (readAccountKind(accountKind) === FAN_ACCOUNT_KIND) {
    return {
      role: 'fan',
      roleLabel: 'ファン',
      displayName: trimmedText(fanName) || 'ユーザー',
    };
  }
  const publicName =
    profile && typeof profile === 'object' ? trimmedText((profile as { name?: unknown }).name) : '';
  return {
    role: 'creator',
    roleLabel: 'クリエイター',
    displayName: publicName || 'ユーザー',
  };
}

export function sessionDisplayName(profile: unknown, fanName: unknown): string {
  const publicName =
    profile && typeof profile === 'object' && typeof (profile as { name?: unknown }).name === 'string'
      ? (profile as { name: string }).name
      : undefined;
  if (typeof publicName === 'string' && publicName.trim()) return publicName;
  if (typeof fanName === 'string' && fanName.trim()) return fanName.trim();
  if (typeof publicName === 'string') return publicName;
  return 'ユーザー';
}
