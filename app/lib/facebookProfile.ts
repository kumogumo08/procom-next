/**
 * Facebook プロフィール URL / 表示名の正規化・フォールバック。
 * facebook.com / www.facebook.com / m.facebook.com に対応する。
 */

const FB_ALLOWED_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
]);

const FB_NON_PROFILE_SEGMENTS = new Set([
  'pages',
  'groups',
  'watch',
  'events',
  'marketplace',
  'gaming',
  'login',
  'reg',
  'recover',
  'help',
  'privacy',
  'policies',
  'settings',
  'bookmarks',
  'friends',
  'messages',
  'notifications',
  'photo',
  'photos',
  'video',
  'videos',
  'reel',
  'reels',
  'story',
  'stories',
  'sharer',
  'share',
  'dialog',
  'plugins',
  'permalink.php',
  'story.php',
]);

function hostIsFacebook(hostname: string): boolean {
  return FB_ALLOWED_HOSTS.has(hostname.toLowerCase());
}

/**
 * Facebook URL として許可するドメインかどうかを判定する。
 * 不正な文字列でも例外を投げず false を返す。
 */
export function isValidFacebookUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(?:www\.|m\.)?facebook\.com\//i.test(trimmed)
      ? `https://${trimmed}`
      : null;

  if (!withProtocol) return false;

  try {
    const u = new URL(withProtocol);
    return hostIsFacebook(u.hostname);
  } catch {
    return false;
  }
}

/**
 * 保存・リンク用に正規化した Facebook URL を返す。
 * 不正・空の場合は空文字。
 */
export function normalizeFacebookUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(?:www\.|m\.)?facebook\.com\//i.test(trimmed)
      ? `https://${trimmed}`
      : null;

  if (!withProtocol) return '';

  try {
    const u = new URL(withProtocol);
    if (!hostIsFacebook(u.hostname)) return '';
    // 正規化: https + 元のホスト + path + search
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return '';
  }
}

/**
 * URL から表示用ユーザー名を抽出する。
 * profile.php?id= の数値 ID は表示名に使わず空文字を返す。
 */
export function extractFacebookUsernameFromUrl(raw: string): string {
  const normalized = normalizeFacebookUrl(raw);
  if (!normalized) return '';

  try {
    const u = new URL(normalized);
    const path = u.pathname.replace(/^\/+|\/+$/g, '');
    const segments = path ? path.split('/') : [];

    // profile.php?id=123 → 数値 ID は使わない
    if (segments[0]?.toLowerCase() === 'profile.php') {
      return '';
    }

    // /people/Name/ID → Name が数値でなければ採用
    if (segments[0]?.toLowerCase() === 'people' && segments[1]) {
      const name = decodeURIComponent(segments[1]).trim();
      if (name && !/^\d+$/.test(name)) return name;
      return '';
    }

    const first = segments[0] ?? '';
    if (!first) return '';
    const withoutAt = first.replace(/^@/, '');
    if (FB_NON_PROFILE_SEGMENTS.has(withoutAt.toLowerCase())) return '';
    if (/^\d+$/.test(withoutAt)) return '';
    // 簡易なユーザー名チェック（英数字・ピリオド・アンダースコア・ハイフン）
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(withoutAt)) return '';
    return withoutAt;
  } catch {
    return '';
  }
}

/**
 * プレビュー / 公開表示用の表示名。
 * 優先順位: 表示名入力 → URL から抽出したユーザー名 → 「Facebookプロフィール」
 */
export function getFacebookDisplayName(
  url: string | undefined | null,
  displayName?: string | undefined | null
): string {
  const trimmedName = displayName?.trim();
  if (trimmedName) return trimmedName;

  const fromUrl = url ? extractFacebookUsernameFromUrl(url) : '';
  if (fromUrl) return fromUrl;

  return 'Facebookプロフィール';
}
