/**
 * BASE独自ドメインのCNAME確認。サーバー専用で、クライアントからはimportしない。
 * 最初のCNAMEが cname.thebase.in と完全一致したときだけ true。
 * これは照会した瞬間の接続先の推定であり、商品の実在や、その後のiframe接続先は保証しない。
 * 商品ページへのHTTPアクセスはしない。利用者の権威DNSへは問い合わせない。
 */

import { Resolver } from 'node:dns/promises';
import { isBaseCustomHostname, readBaseProductCandidate, readBaseShopCandidate, coerceBaseProducts, coerceBaseProductsSettings, sanitizeBaseProducts, BASE_CUSTOM_DOMAIN_ERROR, BASE_PRODUCT_URL_ERROR, BASE_SHOP_URL_ERROR } from '@/lib/baseProducts';
import type { BaseProductsResult, BaseProductsSettings, VerifiedBaseEmbed } from '@/lib/baseProducts';

export const BASE_CNAME_TARGET = 'cname.thebase.in';
export const BASE_DNS_OK_CACHE_MS = 60_000;
export const BASE_DNS_FAIL_CACHE_MS = 15_000;
export const BASE_DNS_TIMEOUT_MS = 2_500;
export const BASE_DNS_MAX_IN_FLIGHT = 4;
export const BASE_DNS_QUEUE_WAIT_MS = 1_000;

export type BaseCnameLookup = (hostname: string) => Promise<readonly string[]>;

export type BaseDnsCheckOptions = {
  lookup?: BaseCnameLookup;
  now?: number;
  timeoutMs?: number;
  cache?: boolean;
  queueWaitMs?: number;
};

type CacheEntry = { ok: boolean; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<boolean>>();
let inFlight = 0;
const waiters: Array<() => void> = [];

export function clearBaseProductDnsCache(): void {
  cache.clear();
}

/** 部分一致は使わない。見るのは先頭の1件だけ。 */
export function cnameTargetMatchesBase(records: readonly unknown[]): boolean {
  const first = records[0];
  if (typeof first !== 'string') return false;
  return first.trim().toLowerCase().replace(/\.$/, '') === BASE_CNAME_TARGET;
}

async function defaultLookup(hostname: string, timeoutMs: number): Promise<readonly string[]> {
  const resolver = new Resolver();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const finish = (error: Error | null, records?: string[]) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(records ?? []);
      };
      timer = setTimeout(() => {
        resolver.cancel();
        const error = new Error('timeout') as NodeJS.ErrnoException;
        error.code = 'ETIMEOUT';
        finish(error);
      }, timeoutMs);
      resolver.resolveCname(hostname).then(
        (records) => finish(null, records),
        (error: unknown) => {
          const wrapped = error instanceof Error ? error : new Error('dns');
          finish(wrapped);
        }
      );
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function acquireSlot(waitMs: number): Promise<boolean> {
  if (inFlight < BASE_DNS_MAX_IN_FLIGHT) {
    inFlight += 1;
    return true;
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const onGrant = () => {
      clearTimeout(timer);
      if (settled) return;
      inFlight += 1;
      finish(true);
    };
    const timer = setTimeout(() => {
      const index = waiters.indexOf(onGrant);
      if (index >= 0) waiters.splice(index, 1);
      finish(false);
    }, waitMs);
    waiters.push(onGrant);
  });
}

function releaseSlot(): void {
  inFlight -= 1;
  const next = waiters.shift();
  if (next) next();
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('timeout') as NodeJS.ErrnoException;
      error.code = 'ETIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

async function lookupHost(hostname: string, options: BaseDnsCheckOptions): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? BASE_DNS_TIMEOUT_MS;
  const useCache = options.cache !== false;
  const now = options.now ?? Date.now();
  if (useCache) {
    const hit = cache.get(hostname);
    if (hit && hit.expiresAt > now) return hit.ok;
  }
  const acquired = await acquireSlot(options.queueWaitMs ?? BASE_DNS_QUEUE_WAIT_MS);
  if (!acquired) return false;
  try {
    const lookup = options.lookup ?? ((host: string) => defaultLookup(host, timeoutMs));
    let ok = false;
    let cacheable = true;
    try {
      const records = await withTimeout(Promise.resolve().then(() => lookup(hostname)), timeoutMs);
      ok = cnameTargetMatchesBase(records);
    } catch (error) {
      ok = false;
      if (errorCode(error) === 'ETIMEOUT') cacheable = false;
    }
    if (useCache && cacheable) {
      const storedAt = options.now ?? Date.now();
      cache.set(hostname, {
        ok,
        expiresAt: storedAt + (ok ? BASE_DNS_OK_CACHE_MS : BASE_DNS_FAIL_CACHE_MS),
      });
    }
    return ok;
  } finally {
    releaseSlot();
  }
}

/** 独自ドメインのホストだけを見る。失敗、不一致、タイムアウトは false。 */
export function verifyBaseCustomHost(hostname: string, options: BaseDnsCheckOptions = {}): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!isBaseCustomHostname(host)) return Promise.resolve(false);
  const existing = inflight.get(host);
  if (existing) return existing;
  const job = lookupHost(host, options).finally(() => {
    if (inflight.get(host) === job) inflight.delete(host);
  });
  inflight.set(host, job);
  return job;
}

/** 保存直前。既存の同一URLは再照会しない。新規・変更の独自ドメインが1件でも失敗したら全体を拒否する。 */
export async function confirmBaseProductsForSave(
  urls: readonly string[],
  existingUrls: unknown,
  options: BaseDnsCheckOptions = {}
): Promise<BaseProductsResult> {
  const sanitized = sanitizeBaseProducts([...urls]);
  if (!sanitized.ok) return sanitized;
  const existing = new Set(coerceBaseProducts(existingUrls));
  const hosts: string[] = [];
  const seenHosts = new Set<string>();
  for (const url of sanitized.urls) {
    const candidate = readBaseProductCandidate(url);
    if (!candidate || candidate.productUrl !== url) {
      return { ok: false, error: BASE_PRODUCT_URL_ERROR };
    }
    if (candidate.hostKind !== 'custom' || existing.has(candidate.productUrl)) continue;
    if (seenHosts.has(candidate.hostname)) continue;
    seenHosts.add(candidate.hostname);
    hosts.push(candidate.hostname);
  }
  const checks = await Promise.all(hosts.map((hostname) => verifyBaseCustomHost(hostname, options)));
  if (checks.some((ok) => !ok)) return { ok: false, error: BASE_CUSTOM_DOMAIN_ERROR };
  return { ok: true, urls: sanitized.urls };
}

/**
 * 公開画面へ渡すウィジェット。失敗した商品だけ除き、保存値は消さない。
 * 同じホストの照会は1回にまとめる。確認からブラウザの接続までには時間差がある。
 */
export async function resolveVerifiedBaseProducts(
  raw: unknown,
  options: BaseDnsCheckOptions = {}
): Promise<VerifiedBaseEmbed[]> {
  try {
    const parsed = coerceBaseProducts(raw)
      .map((url) => readBaseProductCandidate(url))
      .filter((item): item is NonNullable<typeof item> => item != null);
    const hosts: string[] = [];
    const seenHosts = new Set<string>();
    for (const item of parsed) {
      if (item.hostKind !== 'custom' || seenHosts.has(item.hostname)) continue;
      seenHosts.add(item.hostname);
      hosts.push(item.hostname);
    }
    const checks = await Promise.all(hosts.map((hostname) => verifyBaseCustomHost(hostname, options)));
    const allowed = new Set(hosts.filter((_, index) => checks[index]));
    return parsed
      .filter((item) => item.hostKind === 'official' || allowed.has(item.hostname))
      .map((item) => ({ productUrl: item.productUrl, widgetUrl: item.widgetUrl }));
  } catch {
    return [];
  }
}

export type BaseShopSaveResult =
  | { ok: true; shopUrl: string }
  | { ok: false; error: string };

/**
 * 保存直前のショップURL。既存の同一URLは再照会しない。
 * 新規・変更の独自ドメインが失敗したら、このショップURLは保存できない。
 */
export async function confirmBaseShopUrlForSave(
  shopUrl: string,
  existingSettings: unknown,
  options: BaseDnsCheckOptions = {}
): Promise<BaseShopSaveResult> {
  if (shopUrl === '') return { ok: true, shopUrl: '' };
  const candidate = readBaseShopCandidate(shopUrl);
  if (!candidate || candidate.shopUrl !== shopUrl) return { ok: false, error: BASE_SHOP_URL_ERROR };
  if (candidate.hostKind === 'official') return { ok: true, shopUrl: candidate.shopUrl };
  const existing = readBaseShopCandidate(coerceBaseProductsSettings(existingSettings)?.shopUrl ?? '');
  if (existing?.shopUrl === candidate.shopUrl) return { ok: true, shopUrl: candidate.shopUrl };
  const ok = await verifyBaseCustomHost(candidate.hostname, options);
  if (!ok) return { ok: false, error: BASE_CUSTOM_DOMAIN_ERROR };
  return { ok: true, shopUrl: candidate.shopUrl };
}

/**
 * 公開画面のショップリンク。失敗したらリンクを出さない。保存値は消さない。
 * 商品と同じホストの照会は、進行中の確認とキャッシュで重ねない。
 */
export async function resolveVerifiedBaseShopUrl(
  raw: unknown,
  options: BaseDnsCheckOptions = {}
): Promise<string | null> {
  try {
    const candidate = readBaseShopCandidate(coerceBaseProductsSettings(raw)?.shopUrl ?? '');
    if (!candidate) return null;
    if (candidate.hostKind === 'official') return candidate.shopUrl;
    const ok = await verifyBaseCustomHost(candidate.hostname, options);
    return ok ? candidate.shopUrl : null;
  } catch {
    return null;
  }
}

export function emptyBaseShopSettings(): BaseProductsSettings {
  return { description: '', shopUrl: '' };
}
