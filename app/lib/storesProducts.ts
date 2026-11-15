/**
 * STORES商品。貼り付けコードそのものは保存せず、公式ボタンが読む6属性だけを残す。
 * スクリプトは実行しない。商品ページURLは検証済みのショップ名と商品IDから作る。
 * 配列の順番が表示順。最大5件。
 * ショップ紹介文とショップURLは商品とは別。文字数は手動SHOPと同じ規則で数える。
 * ショップURLは https://ショップ名.stores.jp/ だけ。独自ドメインは受け取らない。
 */

import {
  MAX_SHOP_DESCRIPTION,
  SHOP_DESCRIPTION_HINT,
  shopDescriptionLength,
  shopDescriptionOverflows,
} from '@/lib/productGallery';

export { MAX_SHOP_DESCRIPTION, SHOP_DESCRIPTION_HINT, shopDescriptionLength, shopDescriptionOverflows };

export const MAX_STORES_PRODUCTS = 5;
export const STORES_BUTTON_SCRIPT_URL = 'https://btn.stores.jp/button.js';
const MAX_PASTE_LENGTH = 4000;
const MAX_IMAGE_LENGTH = 200;
const SHOP_SUFFIX = '.stores.jp';
const ITEM_ID = /^[a-f0-9]{24}$/;
const LAYOUT = /^layout_[a-z]$/;
const SHOP_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IMAGE_TOKEN = /^[A-Za-z0-9._/-]+$/;
const PRODUCT_KEYS = new Set(['name', 'item', 'variation', 'layout', 'lang', 'image']);
const SMALL_LAYOUT_SIGNS = new Set(['a', 'c', 'e', 'g']);

const LOADER_COMPACT = new Set([
  '(function(d,s,id){varst=d.getElementsByTagName(s)[0];if(d.getElementById(id)){return;}varnst=d.createElement(s);nst.id=id;nst.src="//btn.stores.jp/button.js";nst.charset="UTF-8";st.parentNode.insertBefore(nst,st);})(document,"script","storesjp-button");',
  '(function(d,s,id){varst=d.getElementsByTagName(s)[0];if(d.getElementById(id)){return;}varnst=d.createElement(s);nst.id=id;nst.src="https://btn.stores.jp/button.js";nst.charset="UTF-8";st.parentNode.insertBefore(nst,st);})(document,"script","storesjp-button");',
]);

export const STORES_PASTE_ERROR = 'STORESの購入ボタンの貼り付けコードを確認してください';
const STORES_PASTE_INPUT_ERROR = 'STORESの購入ボタンの貼り付けコードを入力してください';
export const STORES_PRODUCT_COUNT_ERROR = 'STORES商品は5件までです';
export const STORES_PRODUCT_DUPLICATE_ERROR = '同じ商品は登録できません';
const STORES_PRODUCT_SHAPE_ERROR = 'STORES商品の内容を確認してください';
export const STORES_SHOP_URL_ERROR = 'ショップURLは https://ショップ名.stores.jp/ の形式にしてください';
export const STORES_SHOP_DESCRIPTION_ERROR = 'ショップ紹介文は300文字以内で入力してください';
const STORES_SHOP_SETTINGS_ERROR = 'ショップ情報を確認してください';

export type StoresProduct = {
  name: string;
  item: string;
  variation: string;
  layout: string;
  lang: 'ja' | 'en';
  image?: string;
};

export type StoresProductsResult =
  | { ok: true; products: StoresProduct[] }
  | { ok: false; error: string };

export type StoresProductsSettings = {
  description: string;
  shopUrl: string;
};

export type StoresProductsSettingsResult =
  | { ok: true; settings: StoresProductsSettings }
  | { ok: false; error: string };

const EMPTY_SETTINGS: StoresProductsSettings = { description: '', shopUrl: '' };

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function storesProductKey(product: StoresProduct): string {
  return `${product.name}/${product.item}/${product.variation}`;
}

export function storesProductPageUrl(product: StoresProduct): string {
  return `https://${product.name}.stores.jp/items/${product.item}`;
}

export function sameStoresProducts(a: readonly StoresProduct[], b: readonly StoresProduct[]): boolean {
  return (
    a.length === b.length &&
    a.every((product, index) => {
      const other = b[index];
      if (!other) return false;
      return (
        product.name === other.name &&
        product.item === other.item &&
        product.variation === other.variation &&
        product.layout === other.layout &&
        product.lang === other.lang &&
        (product.image ?? '') === (other.image ?? '')
      );
    })
  );
}

/** 公式スクリプトと同じ幅。mobile は iPhone / iPod / Android 携帯かつ幅500未満。 */
export function isStoresButtonMobileViewport(userAgent: string, innerWidth: number): boolean {
  return /iphone|ipod|android.*mobile/.test(userAgent.toLowerCase()) && innerWidth < 500;
}

/** 公式 button.js の幅・高さ。画像があるときはファイル名の _幅x高さ を使う。 */
export function storesButtonSize(product: StoresProduct, mobile: boolean): { width: number; height: number } {
  if (product.image) {
    const match = /_(\d+)x(\d+)/.exec(product.image);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
  }
  if (mobile || SMALL_LAYOUT_SIGNS.has(product.layout.slice(-1))) return { width: 200, height: 44 };
  return { width: 340, height: 60 };
}

function readAttributes(source: string): Record<string, string> | null {
  const attrs: Record<string, string> = {};
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index] ?? '')) index += 1;
    if (index >= source.length) break;
    if (!/[A-Za-z_:]/.test(source[index] ?? '')) return null;
    const nameStart = index;
    index += 1;
    while (index < source.length && /[A-Za-z0-9_:-]/.test(source[index] ?? '')) index += 1;
    const name = source.slice(nameStart, index).toLowerCase();
    while (index < source.length && /\s/.test(source[index] ?? '')) index += 1;
    if (source[index] !== '=') return null;
    index += 1;
    while (index < source.length && /\s/.test(source[index] ?? '')) index += 1;
    const quote = source[index];
    if (quote !== '"' && quote !== "'") return null;
    index += 1;
    const valueStart = index;
    while (index < source.length && source[index] !== quote) {
      const char = source[index] ?? '';
      if (char === '<' || char === '>' || char === '`' || char === '\\') return null;
      if (/[\u0000-\u001f\u007f]/.test(char)) return null;
      index += 1;
    }
    if (source[index] !== quote) return null;
    if (Object.prototype.hasOwnProperty.call(attrs, name)) return null;
    attrs[name] = source.slice(valueStart, index);
    index += 1;
  }
  return attrs;
}

function isOfficialLoader(rest: string): boolean {
  const trimmed = rest.trim();
  if (trimmed === '') return true;
  let body = trimmed;
  const wrapped = trimmed.match(/^<script\b([^>]*)>([\s\S]*)<\/script>$/i);
  if (wrapped) {
    const attrs = (wrapped[1] ?? '').trim();
    if (attrs !== '' && !/^type\s*=\s*(?:"text\/javascript"|'text\/javascript')$/i.test(attrs)) return false;
    body = (wrapped[2] ?? '').trim();
  }
  if (/[<>]/.test(body)) return false;
  const compact = body.replace(/\s+/g, '').replace(/'/g, '"');
  return LOADER_COMPACT.has(compact);
}

function readImage(raw: unknown, present: boolean): { ok: true; image?: string } | { ok: false } {
  if (!present) return { ok: true };
  if (typeof raw !== 'string') return { ok: false };
  const value = raw.trim();
  if (!value || value.length > MAX_IMAGE_LENGTH) return { ok: false };
  if (value.includes('..') || value.includes('//') || value.includes('\\')) return { ok: false };
  if (!IMAGE_TOKEN.test(value)) return { ok: false };
  const match = /_(\d+)x(\d+)/.exec(value);
  if (!match) return { ok: false };
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 1 || height < 1 || width > 1000 || height > 1000) return { ok: false };
  return { ok: true, image: value };
}

function productFromAttributes(attrs: Record<string, string>): StoresProduct | null {
  const allowed = ['class', 'data-storesjp-name', 'data-storesjp-item', 'data-storesjp-variation', 'data-storesjp-layout', 'data-storesjp-lang', 'data-storesjp-image'];
  for (const key of Object.keys(attrs)) {
    if (!allowed.includes(key)) return null;
  }
  if (attrs.class !== 'storesjp-button') return null;
  const name = (attrs['data-storesjp-name'] ?? '').trim().toLowerCase();
  const item = (attrs['data-storesjp-item'] ?? '').trim().toLowerCase();
  const variation = (attrs['data-storesjp-variation'] ?? '').trim().toLowerCase();
  const layout = (attrs['data-storesjp-layout'] ?? '').trim().toLowerCase();
  const lang = (attrs['data-storesjp-lang'] ?? '').trim().toLowerCase();
  if (!SHOP_LABEL.test(name) || !ITEM_ID.test(item) || !ITEM_ID.test(variation) || !LAYOUT.test(layout)) return null;
  if (lang !== 'ja' && lang !== 'en') return null;
  const image = readImage(attrs['data-storesjp-image'], Object.prototype.hasOwnProperty.call(attrs, 'data-storesjp-image'));
  if (!image.ok) return null;
  const product: StoresProduct = { name, item, variation, layout, lang };
  if (image.image) product.image = image.image;
  return product;
}

/** 公式の div と、空または既知の button.js ローダーだけを通す。属性以外は捨てる。 */
export function parseStoresButtonCode(raw: unknown): { ok: true; product: StoresProduct } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: STORES_PASTE_ERROR };
  const value = raw.trim();
  if (!value) return { ok: false, error: STORES_PASTE_INPUT_ERROR };
  if (value.length > MAX_PASTE_LENGTH) return { ok: false, error: STORES_PASTE_ERROR };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return { ok: false, error: STORES_PASTE_ERROR };
  const lower = value.toLowerCase();
  const start = lower.indexOf('<div');
  if (start < 0 || lower.indexOf('<div', start + 4) !== -1) return { ok: false, error: STORES_PASTE_ERROR };
  const after = value.slice(start + 4);
  if (after[0] && /[A-Za-z0-9]/.test(after[0])) return { ok: false, error: STORES_PASTE_ERROR };
  const end = after.indexOf('>');
  if (end < 0) return { ok: false, error: STORES_PASTE_ERROR };
  let attrSource = after.slice(0, end).trim();
  const selfClosing = attrSource.endsWith('/');
  if (selfClosing) attrSource = attrSource.slice(0, -1).trim();
  const attrs = readAttributes(attrSource);
  if (!attrs) return { ok: false, error: STORES_PASTE_ERROR };
  let cursor = start + 4 + end + 1;
  if (!selfClosing) {
    const close = /^(\s*<\/div\s*>)/i.exec(value.slice(cursor));
    if (!close) return { ok: false, error: STORES_PASTE_ERROR };
    cursor += close[1]?.length ?? 0;
  }
  const rest = `${value.slice(0, start)}${value.slice(cursor)}`;
  if (!isOfficialLoader(rest)) return { ok: false, error: STORES_PASTE_ERROR };
  const product = productFromAttributes(attrs);
  if (!product) return { ok: false, error: STORES_PASTE_ERROR };
  return { ok: true, product };
}

export function readStoresProduct(raw: unknown): StoresProduct | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!PRODUCT_KEYS.has(key)) return null;
  }
  const name = trimStr(record.name).toLowerCase();
  const item = trimStr(record.item).toLowerCase();
  const variation = trimStr(record.variation).toLowerCase();
  const layout = trimStr(record.layout).toLowerCase();
  const lang = trimStr(record.lang).toLowerCase();
  if (!SHOP_LABEL.test(name) || !ITEM_ID.test(item) || !ITEM_ID.test(variation) || !LAYOUT.test(layout)) return null;
  if (lang !== 'ja' && lang !== 'en') return null;
  const image = readImage(record.image, Object.prototype.hasOwnProperty.call(record, 'image'));
  if (!image.ok) return null;
  const product: StoresProduct = { name, item, variation, layout, lang };
  if (image.image) product.image = image.image;
  return product;
}

export function sanitizeStoresProducts(raw: unknown): StoresProductsResult {
  if (raw == null) return { ok: true, products: [] };
  if (!Array.isArray(raw)) return { ok: false, error: STORES_PRODUCT_SHAPE_ERROR };
  if (raw.length > MAX_STORES_PRODUCTS) return { ok: false, error: STORES_PRODUCT_COUNT_ERROR };
  const products: StoresProduct[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const product = readStoresProduct(item);
    if (!product) return { ok: false, error: STORES_PRODUCT_SHAPE_ERROR };
    const key = `${product.item}/${product.variation}`;
    if (seen.has(key)) return { ok: false, error: STORES_PRODUCT_DUPLICATE_ERROR };
    seen.add(key);
    products.push(product);
  }
  return { ok: true, products };
}

/** 表示用。壊れた値と重複は出さない。順番は維持し、5件で切る。 */
export function coerceStoresProducts(raw: unknown): StoresProduct[] {
  if (!Array.isArray(raw)) return [];
  const products: StoresProduct[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (products.length >= MAX_STORES_PRODUCTS) break;
    const product = readStoresProduct(item);
    if (!product) continue;
    const key = `${product.item}/${product.variation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    products.push(product);
  }
  return products;
}

export function addStoresProduct(products: readonly StoresProduct[], raw: string): StoresProductsResult {
  const parsed = parseStoresButtonCode(raw);
  if (!parsed.ok) return parsed;
  return sanitizeStoresProducts([...products, parsed.product]);
}

export function replaceStoresProduct(
  products: readonly StoresProduct[],
  index: number,
  raw: string
): StoresProductsResult {
  if (!Number.isInteger(index) || index < 0 || index >= products.length) {
    return { ok: false, error: STORES_PRODUCT_SHAPE_ERROR };
  }
  const parsed = parseStoresButtonCode(raw);
  if (!parsed.ok) return parsed;
  const next = products.map((product, itemIndex) => (itemIndex === index ? parsed.product : product));
  return sanitizeStoresProducts(next);
}

export function removeStoresProduct(products: readonly StoresProduct[], index: number): StoresProductsResult {
  if (!Number.isInteger(index) || index < 0 || index >= products.length) {
    return { ok: false, error: STORES_PRODUCT_SHAPE_ERROR };
  }
  return sanitizeStoresProducts(products.filter((_, itemIndex) => itemIndex !== index));
}

export function moveStoresProduct(
  products: readonly StoresProduct[],
  index: number,
  direction: -1 | 1
): StoresProductsResult {
  if (!Number.isInteger(index) || index < 0 || index >= products.length) {
    return { ok: false, error: STORES_PRODUCT_SHAPE_ERROR };
  }
  const target = index + direction;
  if (target < 0 || target >= products.length) return { ok: true, products: [...products] };
  const next = [...products];
  const [item] = next.splice(index, 1);
  if (!item) return { ok: false, error: STORES_PRODUCT_SHAPE_ERROR };
  next.splice(target, 0, item);
  return { ok: true, products: next };
}

export function storesProductIndexAfterMove(index: number, direction: -1 | 1, length: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= length) return 0;
  const target = index + direction;
  if (target < 0 || target >= length) return index;
  return target;
}

export function storesProductIndexAfterDelete(index: number, length: number): number | null {
  const nextLength = length - 1;
  if (!Number.isInteger(index) || index < 0 || nextLength <= 0) return null;
  if (index < nextLength) return index;
  return nextLength - 1;
}

export function storesProductIndexAfterAdd(length: number): number {
  return Math.max(0, length);
}

export function readStoresShopCandidate(raw: unknown): string | null {
  const value = trimStr(raw);
  if (!value || value.length > 2000) return null;
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
  if (!hostname.endsWith(SHOP_SUFFIX)) return null;
  const label = hostname.slice(0, -SHOP_SUFFIX.length);
  if (!SHOP_LABEL.test(label)) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '') return null;
  return `https://${hostname}/`;
}

function normalizeDescription(raw: unknown): { ok: true; value: string } | { ok: false } {
  if (raw == null || raw === '') return { ok: true, value: '' };
  if (typeof raw !== 'string') return { ok: false };
  const value = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (shopDescriptionLength(value) > MAX_SHOP_DESCRIPTION) return { ok: false };
  return { ok: true, value };
}

export function sanitizeStoresProductsSettings(raw: unknown): StoresProductsSettingsResult {
  if (raw == null) return { ok: true, settings: { ...EMPTY_SETTINGS } };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: STORES_SHOP_SETTINGS_ERROR };
  }
  const record = raw as Record<string, unknown>;
  const description = normalizeDescription(record.description);
  if (!description.ok) return { ok: false, error: STORES_SHOP_DESCRIPTION_ERROR };
  const shopText = trimStr(record.shopUrl);
  if (!shopText) return { ok: true, settings: { description: description.value, shopUrl: '' } };
  const shopUrl = readStoresShopCandidate(shopText);
  if (!shopUrl) return { ok: false, error: STORES_SHOP_URL_ERROR };
  return { ok: true, settings: { description: description.value, shopUrl } };
}

export function coerceStoresProductsSettings(raw: unknown): StoresProductsSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  let description = '';
  if (typeof record.description === 'string') {
    const normalized = record.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    description = Array.from(normalized).slice(0, MAX_SHOP_DESCRIPTION).join('');
  }
  return { description, shopUrl: readStoresShopCandidate(record.shopUrl) ?? '' };
}

export function emptyStoresShopSettings(): StoresProductsSettings {
  return { ...EMPTY_SETTINGS };
}

export function storesShopSectionVisible(input: {
  productCount: number;
  description: string;
  shopLink: string | null;
}): boolean {
  return input.productCount > 0 || input.description.trim().length > 0 || input.shopLink != null;
}
