/**
 * SNS URL からブランドアイコン情報を解決する。
 * プラットフォーム追加時は SNS_PLATFORMS にエントリを足すだけでよい。
 */

export type SnsPlatformId =
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'tiktok'
  | 'github'
  | 'youtube'
  | 'twitch'
  | 'generic';

export type SnsPlatform = {
  id: SnsPlatformId;
  /** Font Awesome クラス（例: fa-brands fa-instagram） */
  iconClass: string;
  brandColor: string;
  match: (hostname: string) => boolean;
};

const hostEndsWith = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

export const SNS_PLATFORMS: SnsPlatform[] = [
  {
    id: 'x',
    iconClass: 'fa-brands fa-x-twitter',
    brandColor: '#000000',
    match: (h) => hostEndsWith(h, 'x.com') || hostEndsWith(h, 'twitter.com'),
  },
  {
    id: 'instagram',
    iconClass: 'fa-brands fa-instagram',
    brandColor: '#E1306C',
    match: (h) => hostEndsWith(h, 'instagram.com'),
  },
  {
    id: 'facebook',
    iconClass: 'fa-brands fa-facebook',
    brandColor: '#1877F2',
    match: (h) => hostEndsWith(h, 'facebook.com') || hostEndsWith(h, 'fb.com'),
  },
  {
    id: 'threads',
    iconClass: 'fa-brands fa-threads',
    brandColor: '#000000',
    match: (h) => hostEndsWith(h, 'threads.net'),
  },
  {
    id: 'tiktok',
    iconClass: 'fa-brands fa-tiktok',
    brandColor: '#000000',
    match: (h) => hostEndsWith(h, 'tiktok.com'),
  },
  {
    id: 'github',
    iconClass: 'fa-brands fa-github',
    brandColor: '#333333',
    match: (h) => hostEndsWith(h, 'github.com'),
  },
  {
    id: 'youtube',
    iconClass: 'fa-brands fa-youtube',
    brandColor: '#FF0000',
    match: (h) => hostEndsWith(h, 'youtube.com') || hostEndsWith(h, 'youtu.be'),
  },
  {
    id: 'twitch',
    iconClass: 'fa-brands fa-twitch',
    brandColor: '#9146FF',
    match: (h) => hostEndsWith(h, 'twitch.tv'),
  },
];

export const GENERIC_SNS_PLATFORM: SnsPlatform = {
  id: 'generic',
  iconClass: 'fa-solid fa-link',
  brandColor: '#555555',
  match: () => true,
};

export function resolveSnsPlatform(url: string): SnsPlatform {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return SNS_PLATFORMS.find((p) => p.match(hostname)) ?? GENERIC_SNS_PLATFORM;
  } catch {
    return GENERIC_SNS_PLATFORM;
  }
}

/** グラデーション等はアイコン色に使えないため、ソリッド色のみ採用する */
export function resolveSnsIconColor(
  color: string | undefined,
  fallback: string
): string {
  if (!color) return fallback;
  if (color.includes('gradient') || color.includes('url(')) return fallback;
  return color;
}
