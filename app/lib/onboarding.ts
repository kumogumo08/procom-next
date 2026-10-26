/**
 * 新規登録者の初期設定状態。公開ページ・一覧・登録APIには未接続。
 * profile.onboardingStatus が無いデータは従来どおり isProfilePublic に従う。
 */
import { isProfilePublic } from '@/lib/userSeo';

/** 名前・肩書きの上限。SEO タイトルと同じ 48 文字。 */
export const ONBOARDING_TEXT_MAX = 48;

export type OnboardingGate = 'legacy' | 'required' | 'complete' | 'unknown';

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** 未設定は legacy。required / complete 以外は unknown。 */
export function readOnboardingGate(profile: unknown): OnboardingGate {
  if (!profile || typeof profile !== 'object') return 'legacy';
  if (!hasOwn(profile, 'onboardingStatus')) return 'legacy';
  const status = (profile as { onboardingStatus?: unknown }).onboardingStatus;
  if (status === 'required' || status === 'complete') return status;
  return 'unknown';
}

function textReady(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= ONBOARDING_TEXT_MAX;
}

/**
 * 先頭写真に https URL があるか。
 * この関数は項目の有無だけを見る。バケット所有の確認はしない。
 */
export function hasOnboardingPhoto(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;
  const photos = (profile as { photos?: unknown }).photos;
  if (!Array.isArray(photos) || photos.length === 0) return false;
  const first = photos[0];
  const url =
    typeof first === 'string'
      ? first
      : first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string'
        ? (first as { url: string }).url
        : '';
  const trimmed = url.trim();
  return trimmed.startsWith('https://') && trimmed.length > 'https://'.length;
}

/** 名前・肩書き・写真が揃っているか。状態が required でも、ここは項目だけを見る。 */
export function isOnboardingProfileComplete(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false;
  const source = profile as { name?: unknown; title?: unknown };
  return textReady(source.name) && textReady(source.title) && hasOnboardingPhoto(profile);
}

/**
 * 初期設定を考慮した公開判定。既存の isProfilePublic は置き換えない。
 * legacy と complete は isPublic に従う。required と未知の値は非公開。
 */
export function isProfilePublicWithOnboarding(profile: unknown): boolean {
  const gate = readOnboardingGate(profile);
  if (gate === 'required' || gate === 'unknown') return false;
  return isProfilePublic(profile);
}

/** required と未知の値だけ本文を隠す。isPublic:false は従来の公開ページのまま。 */
export function isOnboardingBlocked(profile: unknown): boolean {
  const gate = readOnboardingGate(profile);
  return gate === 'required' || gate === 'unknown';
}

/** ログイン後の遷移。required だけ初期設定。それ以外は従来のプロフィール。 */
export function profileLoginPath(uid: string, profile: unknown): string {
  if (readOnboardingGate(profile) === 'required') return '/profile/setup';
  return `/user/${uid}`;
}

/** クライアントが別のURLへ飛ばされないよう、サーバーが返した遷移先を限定する。 */
export function safeLoginRedirect(uid: string, redirectTo: unknown): string {
  if (redirectTo === '/profile/setup') return '/profile/setup';
  return `/user/${uid}`;
}

/** 第三者へプロフィールを返してよいか。未完了でも本人の初期設定用アクセスは許す。 */
export function canExposeProfileToViewer(profile: unknown, viewerUid: unknown, ownerUid: string): boolean {
  if (!isOnboardingBlocked(profile)) return true;
  return typeof viewerUid === 'string' && viewerUid === ownerUid;
}
