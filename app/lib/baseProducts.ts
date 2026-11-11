/**
 * BASE商品。商品URLを正規化して保存し、iframe には許可できたウィジェットURLだけを使う。
 * *.thebase.in は形式だけで許可する。独自ドメインは形式が通っても、サーバーのDNS確認が済むまでウィジェットにしない。
 * 配列の順番が表示順。最大5件。
 * ショップ紹介文とショップURLは商品URLとは別の設定。文字数は手動SHOPと同じ規則で数える。
 */

import {
  MAX_SHOP_DESCRIPTION,
  SHOP_DESCRIPTION_HINT,
  shopDescriptionLength,
  shopDescriptionOverflows,
} from '@/lib/productGallery';

export { MAX_SHOP_DESCRIPTION, SHOP_DESCRIPTION_HINT, shopDescriptionLength, shopDescriptionOverflows };

export const MAX_BASE_PRODUCTS = 5;
const MAX_URL_LENGTH = 2000;
const SHOP_SUFFIX = '.thebase.in';

export const BASE_PRODUCT_URL_ERROR =
  'BASEの商品URLは https://ショップ名.thebase.in/items/商品ID の形式にしてください';
export const BASE_CUSTOM_DOMAIN_ERROR =
  'この独自ドメインはBASEの接続先として確認できませんでした';
const BASE_PRODUCT_INPUT_ERROR = 'BASE商品URLを入力してください';
export const BASE_PRODUCT_COUNT_ERROR = 'BASE商品は5件までです';
export const BASE_PRODUCT_DUPLICATE_ERROR = '同じ商品URLは登録できません';
const BASE_PRODUCT_SHAPE_ERROR = 'BASE商品の内容を確認してください';

export type BaseProductsResult =
  | { ok: true; urls: string[] }
  | { ok: false; error: string };

export type BaseProductRef = {
  productUrl: string;
  widgetUrl: string;
};

export type BaseHostKind = 'official' | 'custom';

export type BaseProductCandidate = BaseProductRef & {
  hostKind: BaseHostKind;
  hostname: string;
};

/** サーバーがDNS確認した独自ドメイン。クライアントはこの組と一致するURLだけをiframeに使う。 */
export type VerifiedBaseEmbed = {
  productUrl: string;
  widgetUrl: string;
};

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** thebase.in の直下に1ラベルだけ。別ドメインやさらに深いホストは拒否する。 */
function isOfficialShopHost(hostname: string): boolean {
  if (!hostname.endsWith(SHOP_SUFFIX)) return false;
  const label = hostname.slice(0, -SHOP_SUFFIX.length);
  if (!label || label.includes('.')) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}

/** DNS確認の対象になるホスト。公式ショップ、IP、ローカル名は含めない。 */
export function isBaseCustomHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253) return false;
  if (host === 'thebase.in' || host.endsWith(SHOP_SUFFIX)) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  if (host.includes(':') || host.includes('%')) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  const labels = host.split('.');
  if (labels.length < 2) return false;
  if (!labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return false;
  const tld = labels[labels.length - 1] ?? '';
  if (tld.length < 2 || /^\d+$/.test(tld)) return false;
  return true;
}

/**
 * 商品ページURLとウィジェットURL。
 * クエリとフラグメントは捨て、ホストは小文字、末尾スラッシュは無くす。
 * 商品IDは数字だけ。確認できていない形式は通さない。
 */
export function readBaseProductCandidate(raw: unknown): BaseProductCandidate | null {
  const value = trimStr(raw);
  if (!value || value.length > MAX_URL_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port !== '' && url.port !== '443') return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const hostKind: BaseHostKind | null = isOfficialShopHost(hostname)
    ? 'official'
    : isBaseCustomHostname(hostname)
      ? 'custom'
      : null;
  if (!hostKind) return null;
  const path = url.pathname.replace(/\/+$/, '');
  const match = /^\/items\/(\d+)(?:\/widget)?$/.exec(path);
  const itemId = match?.[1];
  if (!itemId) return null;
  const productUrl = `https://${hostname}/items/${itemId}`;
  return { productUrl, widgetUrl: `${productUrl}/widget`, hostKind, hostname };
}

/** *.thebase.in だけ。独自ドメインのウィジェットURLはここからは作らない。 */
export function readBaseProductUrl(raw: unknown): BaseProductRef | null {
  const parsed = readBaseProductCandidate(raw);
  if (!parsed || parsed.hostKind !== 'official') return null;
  return { productUrl: parsed.productUrl, widgetUrl: parsed.widgetUrl };
}

export function baseProductPageUrl(raw: unknown): string | null {
  return readBaseProductCandidate(raw)?.productUrl ?? null;
}

export function baseWidgetUrl(raw: unknown): string | null {
  return readBaseProductUrl(raw)?.widgetUrl ?? null;
}

/**
 * 表示してよいウィジェットURL。
 * 公式ショップは形式だけで返す。独自ドメインは、サーバーが返した組と完全一致するときだけ返す。
 */
export function trustedWidgetUrl(
  stored: unknown,
  verified: readonly VerifiedBaseEmbed[] | VerifiedBaseEmbed | null
): string | null {
  const candidate = readBaseProductCandidate(stored);
  if (!candidate) return null;
  if (candidate.hostKind === 'official') return candidate.widgetUrl;
  const list = !verified ? [] : Array.isArray(verified) ? verified : [verified];
  const matched = list.some(
    (item) => item.productUrl === candidate.productUrl && item.widgetUrl === candidate.widgetUrl
  );
  return matched ? candidate.widgetUrl : null;
}

type EntryKind = 'blank' | 'text' | 'invalid';

function entryKind(value: unknown): EntryKind {
  if (value == null) return 'blank';
  if (typeof value !== 'string') return 'invalid';
  return value.trim() === '' ? 'blank' : 'text';
}

/** 保存時の形式。独自ドメインのDNS確認はサーバー側で別に行う。空配列は空のまま返す。 */
export function sanitizeBaseProducts(raw: unknown): BaseProductsResult {
  if (raw == null) return { ok: true, urls: [] };
  if (!Array.isArray(raw)) return { ok: false, error: BASE_PRODUCT_SHAPE_ERROR };
  const texts: string[] = [];
  for (const item of raw) {
    const kind = entryKind(item);
    if (kind === 'invalid') return { ok: false, error: BASE_PRODUCT_SHAPE_ERROR };
    if (kind === 'text') texts.push(trimStr(item));
  }
  if (texts.length > MAX_BASE_PRODUCTS) {
    return { ok: false, error: BASE_PRODUCT_COUNT_ERROR };
  }
  if (texts.length === 0) return { ok: true, urls: [] };
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    const read = readBaseProductCandidate(text);
    if (!read) return { ok: false, error: BASE_PRODUCT_URL_ERROR };
    if (seen.has(read.productUrl)) return { ok: false, error: BASE_PRODUCT_DUPLICATE_ERROR };
    seen.add(read.productUrl);
    urls.push(read.productUrl);
  }
  return { ok: true, urls };
}

/** 表示用の構造検証。壊れた値と重複は出さない。DNSの成否では落とさない。順番は維持し、5件で切る。 */
export function coerceBaseProducts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (urls.length >= MAX_BASE_PRODUCTS) break;
    if (entryKind(item) !== 'text') continue;
    const read = readBaseProductCandidate(item);
    if (!read || seen.has(read.productUrl)) continue;
    seen.add(read.productUrl);
    urls.push(read.productUrl);
  }
  return urls;
}

/** 追加。独自ドメインは、この結果を下書きにする前にサーバー確認を通す。 */
export function addBaseProduct(urls: readonly string[], raw: string): BaseProductsResult {
  if (trimStr(raw) === '') return { ok: false, error: BASE_PRODUCT_INPUT_ERROR };
  return sanitizeBaseProducts([...urls, raw]);
}

/** 1件だけ差し替える。他の商品の順番は維持する。 */
export function replaceBaseProduct(urls: readonly string[], index: number, raw: string): BaseProductsResult {
  if (!Number.isInteger(index) || index < 0 || index >= urls.length) {
    return { ok: false, error: BASE_PRODUCT_SHAPE_ERROR };
  }
  if (trimStr(raw) === '') return { ok: false, error: BASE_PRODUCT_INPUT_ERROR };
  const next = urls.map((url, itemIndex) => (itemIndex === index ? raw : url));
  return sanitizeBaseProducts(next);
}

/** 1件だけ外す。空配列も保存できる。 */
export function removeBaseProduct(urls: readonly string[], index: number): BaseProductsResult {
  if (!Number.isInteger(index) || index < 0 || index >= urls.length) {
    return { ok: false, error: BASE_PRODUCT_SHAPE_ERROR };
  }
  return sanitizeBaseProducts(urls.filter((_, itemIndex) => itemIndex !== index));
}

/** 隣と入れ替える。端では順番を変えない。 */
export function moveBaseProduct(
  urls: readonly string[],
  index: number,
  direction: -1 | 1
): BaseProductsResult {
  if (!Number.isInteger(index) || index < 0 || index >= urls.length) {
    return { ok: false, error: BASE_PRODUCT_SHAPE_ERROR };
  }
  const target = index + direction;
  if (target < 0 || target >= urls.length) return { ok: true, urls: [...urls] };
  const next = [...urls];
  const [item] = next.splice(index, 1);
  if (!item) return { ok: false, error: BASE_PRODUCT_SHAPE_ERROR };
  next.splice(target, 0, item);
  return { ok: true, urls: next };
}

/** 並べ替え後も、動かした商品のタブを選択したままにする。 */
export function baseProductIndexAfterMove(index: number, direction: -1 | 1, length: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= length) return 0;
  const target = index + direction;
  if (target < 0 || target >= length) return index;
  return target;
}

/** 削除後は同じ位置の次の商品、なければ直前。0件なら追加フォーム。 */
export function baseProductIndexAfterDelete(index: number, length: number): number | null {
  const nextLength = length - 1;
  if (!Number.isInteger(index) || index < 0 || nextLength <= 0) return null;
  if (index < nextLength) return index;
  return nextLength - 1;
}

/** 追加に成功した商品は末尾のタブ。 */
export function baseProductIndexAfterAdd(length: number): number {
  return Math.max(0, length);
}

export const BASE_SHOP_URL_ERROR = 'ショップURLはBASEショップのトップページにしてください';
export const BASE_SHOP_DESCRIPTION_ERROR = 'ショップ紹介文は300文字以内で入力してください';
const BASE_SHOP_SETTINGS_ERROR = 'ショップ情報を確認してください';

export type BaseProductsSettings = {
  description: string;
  shopUrl: string;
};

export type BaseProductsSettingsResult =
  | { ok: true; settings: BaseProductsSettings }
  | { ok: false; error: string };

export type BaseShopCandidate = {
  shopUrl: string;
  hostKind: BaseHostKind;
  hostname: string;
};

const EMPTY_BASE_SHOP_SETTINGS: BaseProductsSettings = { description: '', shopUrl: '' };

/**
 * ショップのトップページだけ。商品ページやそれ以外のパスは拒否する。
 * クエリとフラグメントは捨て、ホストは小文字、保存形は末尾スラッシュ付き。
 */
export function readBaseShopCandidate(raw: unknown): BaseShopCandidate | null {
  const value = trimStr(raw);
  if (!value || value.length > MAX_URL_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port !== '' && url.port !== '443') return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const hostKind: BaseHostKind | null = isOfficialShopHost(hostname)
    ? 'official'
    : isBaseCustomHostname(hostname)
      ? 'custom'
      : null;
  if (!hostKind) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '') return null;
  return { shopUrl: `https://${hostname}/`, hostKind, hostname };
}

function normalizeBaseShopDescription(raw: unknown): { ok: true; value: string } | { ok: false } {
  if (raw == null || raw === '') return { ok: true, value: '' };
  if (typeof raw !== 'string') return { ok: false };
  const value = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (shopDescriptionLength(value) > MAX_SHOP_DESCRIPTION) return { ok: false };
  return { ok: true, value };
}

/**
 * 保存時。空文字もオブジェクトとして返す。
 * merge でフィールドを省略すると古い紹介文とショップURLが残るため、空も明示する。
 */
export function sanitizeBaseProductsSettings(raw: unknown): BaseProductsSettingsResult {
  if (raw == null) return { ok: true, settings: { ...EMPTY_BASE_SHOP_SETTINGS } };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: BASE_SHOP_SETTINGS_ERROR };
  }
  const record = raw as Record<string, unknown>;
  const description = normalizeBaseShopDescription(record.description);
  if (!description.ok) return { ok: false, error: BASE_SHOP_DESCRIPTION_ERROR };
  const shopText = trimStr(record.shopUrl);
  if (!shopText) return { ok: true, settings: { description: description.value, shopUrl: '' } };
  const shop = readBaseShopCandidate(shopText);
  if (!shop) return { ok: false, error: BASE_SHOP_URL_ERROR };
  return { ok: true, settings: { description: description.value, shopUrl: shop.shopUrl } };
}

/** 表示用。壊れた紹介文は300文字で切り、ショップとして使えないURLは空にする。 */
export function coerceBaseProductsSettings(raw: unknown): BaseProductsSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  let description = '';
  if (typeof record.description === 'string') {
    const normalized = record.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    description = Array.from(normalized).slice(0, MAX_SHOP_DESCRIPTION).join('');
  }
  const shop = readBaseShopCandidate(record.shopUrl);
  return { description, shopUrl: shop?.shopUrl ?? '' };
}

/**
 * 公開リンクにしてよいショップURL。
 * 公式ショップは形式だけで返す。独自ドメインは、サーバーが返したURLと完全一致するときだけ返す。
 */
export function trustedBaseShopUrl(stored: unknown, verifiedShopUrl: string | null): string | null {
  const candidate = readBaseShopCandidate(stored);
  if (!candidate) return null;
  if (candidate.hostKind === 'official') return candidate.shopUrl;
  if (verifiedShopUrl && verifiedShopUrl === candidate.shopUrl) return candidate.shopUrl;
  return null;
}

/** 表示できる商品、紹介文、安全なショップURLのどれかがあれば公開する。 */
export function baseShopSectionVisible(input: {
  productCount: number;
  description: string;
  shopLink: string | null;
}): boolean {
  return input.productCount > 0 || input.description.trim().length > 0 || input.shopLink != null;
}
