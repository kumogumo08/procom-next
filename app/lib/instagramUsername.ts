/**
 * Instagram ユーザー名の正規化。
 * プレーンなユーザー名、および instagram.com のプロフィール URL に対応する。
 */

const IG_NON_PROFILE_SEGMENTS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'about',
  'developer',
  'legal',
  'directory',
  'challenge',
  'tags',
  'locations',
  'direct',
  'nametag',
]);

function hostIsInstagram(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  return host === 'instagram.com' || host.endsWith('.instagram.com');
}

/**
 * 保存値（ユーザー名 or URL）から表示・リンク用のユーザー名を返す。
 * 抽出できない場合は空文字。
 */
export function normalizeInstagramUsername(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const maybeUrl =
    /^https?:\/\//i.test(trimmed)
      ? trimmed
      : /^(?:www\.)?instagram\.com\//i.test(trimmed)
        ? `https://${trimmed}`
        : null;

  if (maybeUrl) {
    try {
      const u = new URL(maybeUrl);
      if (!hostIsInstagram(u.hostname)) return '';
      const segment = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
      if (!segment) return '';
      const withoutAt = segment.replace(/^@/, '');
      if (IG_NON_PROFILE_SEGMENTS.has(withoutAt.toLowerCase())) return '';
      // Instagram: 英数字・ピリオド・アンダースコア、最大30文字
      if (!/^[A-Za-z0-9._]{1,30}$/.test(withoutAt)) return '';
      return withoutAt;
    } catch {
      return '';
    }
  }

  const withoutAt = trimmed.replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(withoutAt)) return '';
  return withoutAt;
}

export function formatInstagramHandle(username: string): string {
  const normalized = normalizeInstagramUsername(username);
  if (!normalized) return 'Instagram';
  return `@${normalized}`;
}

export function buildInstagramProfileUrl(username: string): string {
  const normalized = normalizeInstagramUsername(username);
  if (!normalized) return '';
  return `https://www.instagram.com/${encodeURIComponent(normalized)}/`;
}
