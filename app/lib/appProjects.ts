/**
 * ユーザープロフィール上の「公開アプリ」ブロック用。
 * 将来 testerRecruiting / participants 等を足しやすいようオブジェクト構造で保持する。
 */

import { v4 as uuidv4 } from 'uuid';

export type AppProjectReleaseStatus = 'published' | 'review' | 'coming_soon';

/** 将来のテスター募集機能用プレースホルダー（MVPでは UI なし） */
export type AppProjectTesterRecruiting = {
  enabled?: boolean;
};

export type AppProject = {
  id: string;
  title: string;
  shortDescription?: string;
  /** App Store / 将来 Google Play から取得した公式説明（保存はサーバー側 enrich） */
  storeDescription?: string;
  appStoreUrl?: string;
  googlePlayUrl?: string;
  websiteUrl?: string;
  iconUrl?: string;
  screenshotUrls?: string[];
  showQrCode?: boolean;
  /** @deprecated 旧データ互換のみ。UI・表示・新規保存では使用しない（ブロックは showApps で制御） */
  isPublic?: boolean;
  displayOrder?: number;
  releaseStatus?: AppProjectReleaseStatus;
  createdAt?: string;
  updatedAt?: string;
  testerRecruiting?: AppProjectTesterRecruiting;
  /** 将来: testerParticipants, testerStats, shareTemplates などをここに追加可能 */
};

/** 1プロフィールあたりのアプリ掲載上限（クライアント・サーバー共通） */
export const MAX_APP_PROJECTS_PER_PROFILE = 5;

const MAX_SCREENSHOTS = 3;
const MAX_TITLE = 120;

/** shortDescription の最大文字数（後方互換・sanitize のみ） */
export const MAX_APP_SHORT_DESCRIPTION = 280;
const MAX_DESC = MAX_APP_SHORT_DESCRIPTION;

/** Firestore 保存する storeDescription の最大長（iTunes の長文に余裕を持たせる） */
export const MAX_APP_STORE_DESCRIPTION_LENGTH = 8000;

function trimStr(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.trim();
}

function normalizeStoreDescriptionStored(v: unknown): string | undefined {
  const s = trimStr(v);
  if (!s) return undefined;
  return s.slice(0, MAX_APP_STORE_DESCRIPTION_LENGTH);
}

function isValidHttpUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** App Store 製品ページ（apps.apple.com かつパスに /id数字 を含む） */
export function isValidAppStoreUrl(raw: string): boolean {
  const s = trimStr(raw);
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.hostname.toLowerCase() !== 'apps.apple.com') return false;
    return /\/id\d+/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Google Play のアプリ details ページ（/store/apps/details?id=） */
export function isValidGooglePlayUrl(raw: string): boolean {
  const s = trimStr(raw);
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.hostname.toLowerCase() !== 'play.google.com') return false;
    const p = u.pathname.replace(/\/$/, '');
    if (p !== '/store/apps/details') return false;
    const id = u.searchParams.get('id');
    return Boolean(id && trimStr(id).length > 0);
  } catch {
    return false;
  }
}

/**
 * 各ストア URL が非空のとき、対応ホスト・パス形式か検証する（サーバー POST 用）。
 * 戻り値: 問題なし null / ユーザー向けメッセージ1件
 */
/**
 * POST 直後の raw apps 配列を検証（sanitize 前）。
 * 件数上限・各アプリのタイトル必須。
 */
export function validateRawAppsPayloadForProfile(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_APP_PROJECTS_PER_PROFILE) {
    return 'アプリは最大5件まで追加できます';
  }
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const t = trimStr((item as Record<string, unknown>).title);
    if (!t) {
      return 'アプリ名を入力してください';
    }
  }
  return null;
}

export function validateAppStoreUrlFields(apps: AppProject[]): string | null {
  for (let i = 0; i < apps.length; i++) {
    const a = apps[i];
    const asu = trimStr(a.appStoreUrl ?? '');
    const gpu = trimStr(a.googlePlayUrl ?? '');
    if (asu && !isValidAppStoreUrl(asu)) {
      const label = a.title?.trim() || `アプリ${i + 1}`;
      return `「${label}」の App Store URL の形式が正しくありません`;
    }
    if (gpu && !isValidGooglePlayUrl(gpu)) {
      const label = a.title?.trim() || `アプリ${i + 1}`;
      return `「${label}」の Google Play URL の形式が正しくありません`;
    }
  }
  return null;
}

function normalizeOptionalUrl(v: unknown): string | undefined {
  const s = trimStr(v);
  if (!s) return undefined;
  return isValidHttpUrl(s) ? s : undefined;
}

function normalizeScreenshotUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const u = normalizeOptionalUrl(item);
    if (u) out.push(u);
    if (out.length >= MAX_SCREENSHOTS) break;
  }
  return out;
}

function normalizeReleaseStatus(v: unknown): AppProjectReleaseStatus {
  if (v === 'published' || v === 'review' || v === 'coming_soon') return v;
  return 'published';
}

/**
 * Firestore はフィールド値に undefined を許可しない。ネストしたオブジェクトも再帰的に除去する。
 */
function stripUndefinedDeep<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[key] = stripUndefinedDeep(v as Record<string, unknown>);
    } else {
      out[key] = v;
    }
  }
  return out as T;
}

type SanitizeMode = 'save' | 'read';

/**
 * 1件分を整形（不正値は落とす）
 * - save: updatedAt を現在時刻に（保存時）
 * - read: Firestore からの読み取り用。タイムスタンプは既存値を維持
 */
export function sanitizeAppProject(
  input: unknown,
  index: number,
  existingId?: string,
  mode: SanitizeMode = 'save'
): AppProject | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;

  const title = trimStr(o.title).slice(0, MAX_TITLE);
  if (!title) return null;

  const now = new Date().toISOString();
  const id =
    typeof o.id === 'string' && o.id.trim().length > 0
      ? o.id.trim()
      : existingId && existingId.trim()
        ? existingId.trim()
        : `app_${uuidv4()}`;

  const createdAtRead =
    typeof o.createdAt === 'string' && o.createdAt.trim() ? o.createdAt.trim() : undefined;
  const updatedAtRead =
    typeof o.updatedAt === 'string' && o.updatedAt.trim() ? o.updatedAt.trim() : undefined;

  const createdAt = mode === 'read' ? createdAtRead ?? now : createdAtRead ?? now;

  const releaseStatus = normalizeReleaseStatus(o.releaseStatus);

  const testerRecruiting: AppProjectTesterRecruiting = {
    enabled:
      typeof o.testerRecruiting === 'object' && o.testerRecruiting !== null
        ? (o.testerRecruiting as AppProjectTesterRecruiting).enabled === true
        : false,
  };

  const updatedAt = mode === 'read' ? updatedAtRead ?? createdAt : now;

  const shortDescRead =
    mode === 'read' ? trimStr(o.shortDescription).slice(0, MAX_DESC) : '';
  const storeDescRead =
    mode === 'read' ? normalizeStoreDescriptionStored(o.storeDescription) : undefined;
  const appStoreUrl = normalizeOptionalUrl(o.appStoreUrl);
  const googlePlayUrl = normalizeOptionalUrl(o.googlePlayUrl);
  const websiteUrl = normalizeOptionalUrl(o.websiteUrl);
  const iconUrlRead = mode === 'read' ? normalizeOptionalUrl(o.iconUrl) : undefined;
  const screenshotUrlsRead =
    mode === 'read' ? normalizeScreenshotUrls(o.screenshotUrls) : [];

  const app: AppProject = {
    id,
    title,
    ...(mode === 'read' && shortDescRead ? { shortDescription: shortDescRead } : {}),
    ...(mode === 'read' && storeDescRead ? { storeDescription: storeDescRead } : {}),
    ...(appStoreUrl ? { appStoreUrl } : {}),
    ...(googlePlayUrl ? { googlePlayUrl } : {}),
    ...(websiteUrl ? { websiteUrl } : {}),
    ...(mode === 'read' && iconUrlRead ? { iconUrl: iconUrlRead } : {}),
    ...(mode === 'read' && screenshotUrlsRead.length > 0
      ? { screenshotUrls: screenshotUrlsRead }
      : {}),
    showQrCode: o.showQrCode !== false,
    displayOrder: typeof o.displayOrder === 'number' && Number.isFinite(o.displayOrder) ? o.displayOrder : index,
    releaseStatus,
    createdAt,
    updatedAt,
    testerRecruiting,
  };

  return stripUndefinedDeep(app as unknown as Record<string, unknown>) as AppProject;
}

/**
 * App Store / Google Play のどちらか有効なURLが必要（MVPの保存ルール）。
 * 両方空なら不可。戻り値: 問題なし null / ユーザー向けメッセージ
 */
export function validateAppsHaveAtLeastOneStoreUrl(apps: AppProject[]): string | null {
  for (let i = 0; i < apps.length; i++) {
    const a = apps[i];
    const has = Boolean(a.appStoreUrl || a.googlePlayUrl);
    if (!has) {
      const label = a.title?.trim() || `アプリ${i + 1}`;
      return `「${label}」には App Store または Google Play のURLを、どちらか1つ以上入力してください。`;
    }
  }
  return null;
}

/**
 * 配列全体を最大件数まで整形し、displayOrder を 0..n-1 にそろえる
 */
export function sanitizeAppsArray(raw: unknown, existing?: unknown): AppProject[] {
  const existingById = new Map<string, AppProject>();
  if (Array.isArray(existing)) {
    for (const e of existing) {
      if (e && typeof e === 'object' && typeof (e as AppProject).id === 'string') {
        existingById.set((e as AppProject).id, e as AppProject);
      }
    }
  }

  if (!Array.isArray(raw)) return [];

  const out: AppProject[] = [];
  for (let index = 0; index < raw.length && out.length < MAX_APP_PROJECTS_PER_PROFILE; index++) {
    const item = raw[index];
    const exId =
      item && typeof item === 'object' && typeof (item as { id?: string }).id === 'string'
        ? String((item as { id: string }).id)
        : undefined;
    const sanitized = sanitizeAppProject(item, index, exId, 'save');
    if (!sanitized) continue;
    const prev = exId ? existingById.get(exId) : undefined;
    if (prev?.createdAt) {
      sanitized.createdAt = prev.createdAt;
    }
    // アイコンは手入力なし。既存 iconUrl を引き継ぎ、保存 API 側で App Store Lookup により更新し得る（app/lib/appIcons.ts）
    const prevIcon = prev?.iconUrl ? normalizeOptionalUrl(prev.iconUrl) : undefined;
    if (prevIcon && !sanitized.iconUrl) {
      sanitized.iconUrl = prevIcon;
    }
    const prevShort = prev?.shortDescription ? trimStr(prev.shortDescription).slice(0, MAX_DESC) : '';
    if (prevShort && !sanitized.shortDescription) {
      sanitized.shortDescription = prevShort;
    }
    const prevStore = prev?.storeDescription
      ? normalizeStoreDescriptionStored(prev.storeDescription)
      : undefined;
    if (prevStore && !sanitized.storeDescription) {
      sanitized.storeDescription = prevStore;
    }
    out.push(sanitized);
  }

  out.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  out.forEach((a, i) => {
    a.displayOrder = i;
  });

  return out;
}

/** GET / SSR 用: タイムスタンプを勝手に更新しない */
export function coerceAppsFromFirestore(raw: unknown): AppProject[] {
  if (!Array.isArray(raw)) return [];
  const out: AppProject[] = [];
  for (let index = 0; index < raw.length && out.length < MAX_APP_PROJECTS_PER_PROFILE; index++) {
    const item = raw[index];
    const exId =
      item && typeof item === 'object' && typeof (item as { id?: string }).id === 'string'
        ? String((item as { id: string }).id)
        : undefined;
    const coerced = sanitizeAppProject(item, index, exId, 'read');
    if (coerced) out.push(coerced);
  }
  out.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  out.forEach((a, i) => {
    a.displayOrder = i;
  });
  return out;
}

/** 他人向け: 全件（アプリ単位の非公開は廃止。ブロック表示は showApps で制御） */
export function filterAppsForPublicView(apps: AppProject[] | undefined | null): AppProject[] {
  if (!Array.isArray(apps)) return [];
  return [...apps];
}

/** QR に使う URL（優先: App Store → Google Play → 公式） */
export function getAppQrTargetUrl(app: AppProject): string | undefined {
  return app.appStoreUrl || app.googlePlayUrl || app.websiteUrl;
}
