/**
 * X（旧Twitter）ユーザー名の正規化。
 * プレーンなユーザー名、および x.com / twitter.com のプロフィール URL に対応する。
 */

const X_NON_PROFILE_SEGMENTS = new Set([
  'home',
  'explore',
  'search',
  'settings',
  'i',
  'intent',
  'share',
  'compose',
  'messages',
  'notifications',
  'login',
  'signup',
  'tos',
  'privacy',
  'about',
  'download',
  'jobs',
  'hashtag',
]);

function hostIsX(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  return (
    host === 'x.com' ||
    host === 'twitter.com' ||
    host.endsWith('.x.com') ||
    host.endsWith('.twitter.com')
  );
}

/**
 * 保存値（ユーザー名 or URL）から表示・リンク用のユーザー名を返す。
 * 抽出できない場合は空文字。
 */
export function normalizeXUsername(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const maybeUrl =
    /^https?:\/\//i.test(trimmed)
      ? trimmed
      : /^(?:www\.)?(?:x\.com|twitter\.com)\//i.test(trimmed)
        ? `https://${trimmed}`
        : null;

  if (maybeUrl) {
    try {
      const u = new URL(maybeUrl);
      if (!hostIsX(u.hostname)) return '';
      const segment = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
      if (!segment) return '';
      const withoutAt = segment.replace(/^@/, '');
      if (X_NON_PROFILE_SEGMENTS.has(withoutAt.toLowerCase())) return '';
      // URL 由来は英数字とアンダースコアのみ許可
      if (!/^[A-Za-z0-9_]{1,50}$/.test(withoutAt)) return '';
      return withoutAt;
    } catch {
      return '';
    }
  }

  // 既存データはプレーンなユーザー名想定。先頭の @ を除去し、X の文字種のみ許可する。
  const withoutAt = trimmed.replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9_]{1,50}$/.test(withoutAt)) return '';
  return withoutAt;
}

export function formatXHandle(username: string): string {
  const normalized = normalizeXUsername(username);
  if (!normalized) return 'X';
  return `@${normalized}`;
}

export function buildXProfileUrl(username: string): string {
  const normalized = normalizeXUsername(username);
  if (!normalized) return '';
  return `https://x.com/${encodeURIComponent(normalized)}`;
}
