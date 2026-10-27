import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

/** 短縮URLの展開と、展開後の動画URLで使うホストだけ。 */
export const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 4000;

export class TikTokResolveError extends Error {
  readonly status: 400 | 500;

  constructor(status: 400 | 500) {
    super(status === 400 ? 'TikTok動画URLではありません' : 'URL解決に失敗しました');
    this.name = 'TikTokResolveError';
    this.status = status;
  }
}

export type TikTokFetch = (url: string) => Promise<{ headers: { get(name: string): string | null } }>;

/** 接続先が内部アドレスなら拒否する。許可ホストのDNS応答が混在している場合も拒否する。 */
export function selectPublicAddresses(addresses: readonly string[]): string[] | null {
  if (addresses.length === 0 || addresses.some((address) => isBlockedIp(address))) return null;
  return [...addresses];
}

export function isBlockedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

export function createSafeLookup(resolve: typeof dnsLookup = dnsLookup): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) {
        callback(err, '', 4);
        return;
      }
      const list = (Array.isArray(addresses) ? addresses : []) as LookupAddress[];
      const selected = selectPublicAddresses(list.map((item) => item.address));
      if (!selected) {
        const blocked = new Error('blocked') as NodeJS.ErrnoException;
        blocked.code = 'EBLOCKED';
        callback(blocked, '', 4);
        return;
      }
      if (options.all) {
        callback(null, list);
        return;
      }
      callback(null, list[0].address, list[0].family);
    });
  };
}

let dispatcher: Agent | undefined;

function sharedDispatcher(): Agent {
  if (!dispatcher) {
    dispatcher = new Agent({
      connect: { lookup: createSafeLookup(), timeout: REQUEST_TIMEOUT_MS },
      connectTimeout: REQUEST_TIMEOUT_MS,
      headersTimeout: REQUEST_TIMEOUT_MS,
      bodyTimeout: 1000,
    });
  }
  return dispatcher;
}

async function defaultFetch(url: string): Promise<{ headers: { get(name: string): string | null } }> {
  const response = await undiciFetch(url, {
    method: 'GET',
    redirect: 'manual',
    dispatcher: sharedDispatcher(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await response.body?.cancel().catch(() => undefined);
  return response;
}

export function parseTikTokUrl(raw: string): URL {
  if (raw.length === 0 || raw.length > MAX_URL_LENGTH || /[\u0000-\u001F\u007F]/.test(raw)) {
    throw new TikTokResolveError(400);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TikTokResolveError(400);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new TikTokResolveError(400);
  }
  const hostname = url.hostname.toLowerCase();
  if (isIP(hostname.replace(/^\[|\]$/g, '')) !== 0 || !TIKTOK_HOSTS.has(hostname)) {
    throw new TikTokResolveError(400);
  }
  return url;
}

function isVideoUrl(url: URL): boolean {
  return /\/video\/\d+/.test(url.pathname);
}

function nextUrl(current: URL, location: string): URL {
  if (location.length === 0 || location.length > MAX_URL_LENGTH || /[\u0000-\u001F\u007F]/.test(location)) {
    throw new TikTokResolveError(400);
  }
  let resolved: URL;
  try {
    resolved = new URL(location, current);
  } catch {
    throw new TikTokResolveError(400);
  }
  return parseTikTokUrl(resolved.href);
}

/**
 * 短縮URLを動画URLまで展開する。fetch前と各リダイレクト先でホストを確認する。
 * 既に動画URLなら接続しない。
 */
export async function resolveTikTokVideoUrl(raw: unknown, fetchImpl: TikTokFetch = defaultFetch): Promise<string> {
  if (typeof raw !== 'string') throw new TikTokResolveError(400);
  let current = parseTikTokUrl(raw.trim());
  for (let followed = 0; ; followed += 1) {
    if (isVideoUrl(current)) return current.href;
    if (followed >= MAX_REDIRECTS) throw new TikTokResolveError(400);
    let response: { headers: { get(name: string): string | null } };
    try {
      response = await fetchImpl(current.href);
    } catch (err: unknown) {
      if (err instanceof TikTokResolveError) throw err;
      throw new TikTokResolveError(500);
    }
    const location = response.headers.get('location');
    if (!location) throw new TikTokResolveError(400);
    current = nextUrl(current, location);
  }
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (/^fe[89ab]/.test(lower) || /^fe[cdef]/.test(lower)) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('ff')) return true;
  if (lower.startsWith('2001:db8')) return true;
  const embedded = embeddedIpv4(lower);
  if (embedded) return isBlockedIpv4(embedded);
  return false;
}

/** IPv4射影アドレス。解釈できない射影形式は拒否する。 */
function embeddedIpv4(address: string): string | null {
  const dotted = address.match(/^(?:0:){5}ffff:(\d+\.\d+\.\d+\.\d+)$|^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1] ?? dotted[2];
  if (!address.includes('ffff')) return null;
  const parts = expandIpv6(address);
  if (!parts || parts.slice(0, 5).some((part) => part !== '0') || parts[5] !== 'ffff') return null;
  const hi = Number.parseInt(parts[6], 16);
  const lo = Number.parseInt(parts[7], 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo) || hi > 0xffff || lo > 0xffff) return address;
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

function expandIpv6(address: string): string[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  if (head.some((part) => part === '') || tail.some((part) => part === '')) return null;
  const missing = 8 - (head.length + tail.length);
  if (halves.length === 1) return head.length === 8 ? head : null;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill('0'), ...tail];
}
