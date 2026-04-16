/**
 * ストア URL からアプリアイコン URL を解決する（サーバー専用）。
 * 取得失敗時は null を返し、呼び出し側の保存は継続する。
 */

import type { AppProject } from './appProjects';
import { MAX_APP_STORE_DESCRIPTION_LENGTH } from './appProjects';

/** App Store / iTunes の Web URL から数値の app id を抽出する */
export function extractAppStoreId(url: string): string | null {
  const s = typeof url === 'string' ? url.trim() : '';
  if (!s) return null;
  try {
    const u = new URL(s);
    const pathMatch = u.pathname.match(/\/id(\d+)/i);
    if (pathMatch) return pathMatch[1];
    const q = u.searchParams.get('id');
    if (q && /^\d+$/.test(q)) return q;
  } catch {
    const pathMatch = s.match(/\/id(\d+)/i);
    if (pathMatch) return pathMatch[1];
    const qMatch = s.match(/[?&]id=(\d+)/i);
    if (qMatch) return qMatch[1];
  }
  return null;
}

type ItunesLookupResponse = {
  resultCount?: number;
  results?: Array<{
    artworkUrl60?: string;
    artworkUrl100?: string;
    artworkUrl512?: string;
    description?: string;
  }>;
};

export type AppStoreLookupResult = {
  iconUrl: string | null;
  description: string | null;
};

/**
 * iTunes Lookup API でアイコン URL と説明文を 1 回の fetch で取得する。
 * @see https://performance-partners.apple.com/search-api
 */
export async function fetchAppStoreLookup(appStoreUrl: string): Promise<AppStoreLookupResult> {
  const id = extractAppStoreId(appStoreUrl);
  if (!id) {
    console.warn('[fetchAppStoreLookup] could not extract app id from URL');
    return { iconUrl: null, description: null };
  }
  const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=jp&lang=ja_jp`;
  try {
    const res = await fetch(lookupUrl, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('[fetchAppStoreLookup] lookup HTTP error', res.status, id);
      return { iconUrl: null, description: null };
    }
    const data = (await res.json()) as ItunesLookupResponse;
    const r = data.results?.[0];
    if (!r) {
      console.warn('[fetchAppStoreLookup] no results for id', id);
      return { iconUrl: null, description: null };
    }
    const art =
      (typeof r.artworkUrl512 === 'string' && r.artworkUrl512) ||
      (typeof r.artworkUrl100 === 'string' && r.artworkUrl100) ||
      (typeof r.artworkUrl60 === 'string' && r.artworkUrl60) ||
      null;
    const iconUrl = art && art.startsWith('https://') ? art : null;
    const description =
      typeof r.description === 'string' && r.description.trim() ? r.description.trim() : null;
    return { iconUrl, description };
  } catch (e) {
    console.warn('[fetchAppStoreLookup] fetch failed', e);
    return { iconUrl: null, description: null };
  }
}

/**
 * iTunes Lookup API でアイコン URL を取得する。
 * @see https://performance-partners.apple.com/search-api
 */
export async function resolveAppStoreIconUrl(appStoreUrl: string): Promise<string | null> {
  const { iconUrl } = await fetchAppStoreLookup(appStoreUrl);
  return iconUrl;
}

/** Google Play の details URL から package 名（id パラメータ）を抽出する */
export function extractGooglePlayPackageId(url: string): string | null {
  const s = typeof url === 'string' ? url.trim() : '';
  if (!s) return null;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('play.google.com')) return null;
    const id = u.searchParams.get('id');
    if (id && isLikelyAndroidPackageId(id)) return id;
  } catch {
    const m = s.match(/[?&]id=([^&]+)/);
    if (m) {
      try {
        const id = decodeURIComponent(m[1]);
        if (isLikelyAndroidPackageId(id)) return id;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isLikelyAndroidPackageId(id: string): boolean {
  if (id.length < 3 || id.length > 256) return false;
  return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/.test(id);
}

/**
 * TODO: Google Play アイコン取得
 * - 公式の単純 JSON API は無いため、将来は Play ページのメタデータ取得・別 API・キャッシュ等を検討
 * - packageId は extractGooglePlayPackageId(googlePlayUrl) で取得できる
 *
 * export async function resolveGooglePlayIconUrl(packageId: string): Promise<string | null> {
 *   return null;
 * }
 */

/**
 * sanitize 済みの各アプリに対し、App Store URL があれば iTunes Lookup で iconUrl / storeDescription を付与する。
 * Google Play のみの場合は現状スキップ（TODO 差し込み位置）。
 */
export async function enrichAppsWithStoreIcons(apps: AppProject[]): Promise<AppProject[]> {
  return Promise.all(
    apps.map(async (app) => {
      const next: AppProject = { ...app };
      if (next.appStoreUrl) {
        try {
          const meta = await fetchAppStoreLookup(next.appStoreUrl);
          if (meta.iconUrl) next.iconUrl = meta.iconUrl;
          if (meta.description) {
            next.storeDescription = meta.description.slice(0, MAX_APP_STORE_DESCRIPTION_LENGTH);
          }
        } catch (e) {
          console.warn('[enrichAppsWithStoreIcons] App Store lookup failed', app.id, e);
        }
        return next;
      }
      if (next.googlePlayUrl) {
        const pkg = extractGooglePlayPackageId(next.googlePlayUrl);
        if (pkg) {
          // TODO: Google Play icon resolver — const icon = await resolveGooglePlayIconUrl(pkg); if (icon) next.iconUrl = icon;
          // TODO: Google Play description resolver — merge into storeDescription when App Store URL なし
        }
      }
      return next;
    })
  );
}
