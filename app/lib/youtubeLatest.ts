/** search.list は検索専用枠（標準100回/日）。uploads の playlistItems.list は通常枠の1ユニット。 */
export const YOUTUBE_SUCCESS_TTL_MS = 12 * 60 * 60 * 1000;
export const YOUTUBE_ERROR_TTL_MS = 15 * 60 * 1000;
export const YOUTUBE_UPSTREAM_BURST = 20;
export const YOUTUBE_UPSTREAM_BURST_WINDOW_MS = 60_000;
export const YOUTUBE_UPSTREAM_DAILY = 2000;
export const YOUTUBE_UPSTREAM_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_RAW_LENGTH = 240;
const CACHE_LIMIT = 4000;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const UNAVAILABLE_MESSAGE = '動画を取得できませんでした';
const REJECTED_MESSAGE = 'チャンネルIDの形式を確認してください';
const UNKNOWN_CHANNEL_MESSAGE = 'チャンネルを確認できませんでした';

export type YoutubeLatestSuccess = { ok: true; channelId: string; videos: string[] };
export type YoutubeLatestFailure = { ok: false; status: 400 | 404 | 503; error: string };
export type YoutubeLatestResult = YoutubeLatestSuccess | YoutubeLatestFailure;

type CacheEntry = {
  videos: string[];
  freshUntil: number;
  errorStatus: 404 | 503 | null;
};

type WindowState = { count: number; resetAt: number };

let nowFn = () => Date.now();
let minuteWindow: WindowState | null = null;
let dayWindow: WindowState | null = null;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<YoutubeLatestResult>>();

export function setYouTubeClockForTests(fn: () => number): void {
  nowFn = fn;
}

export function resetYouTubeLatestForTests(): void {
  nowFn = () => Date.now();
  minuteWindow = null;
  dayWindow = null;
  cache.clear();
  inflight.clear();
}

export function normalizeYouTubeChannelId(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_RAW_LENGTH) return null;
  if (/[\u0000-\u001F\u007F]/.test(raw)) return null;
  const trimmed = raw.trim();
  if (CHANNEL_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== 'youtube.com' && host !== 'www.youtube.com' && host !== 'm.youtube.com') return null;
  if (url.username || url.password || url.port) return null;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const path = url.pathname.replace(/\/+$/, '');
  const match = path.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/(?:videos|featured|streams|playlists))?$/);
  if (!match) return null;
  return match[1];
}

export function shouldFetchYouTubeLatest(input: {
  mode: string;
  channelId: string;
  isEditable: boolean;
  showYouTube: boolean | undefined;
}): boolean {
  if (input.mode !== 'latest') return false;
  if (!input.channelId.trim()) return false;
  if (!input.isEditable && input.showYouTube === false) return false;
  return true;
}

function remember(channelId: string, entry: CacheEntry): void {
  if (cache.has(channelId)) cache.delete(channelId);
  cache.set(channelId, entry);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== 'string') break;
    cache.delete(oldest);
  }
}

function take(window: WindowState | null, limit: number, windowMs: number): { window: WindowState; ok: boolean } {
  const now = nowFn();
  if (!window || window.resetAt <= now) {
    return { window: { count: 1, resetAt: now + windowMs }, ok: true };
  }
  if (window.count >= limit) return { window, ok: false };
  window.count += 1;
  return { window, ok: true };
}

function allowUpstream(): boolean {
  const nextMinute = take(minuteWindow, YOUTUBE_UPSTREAM_BURST, YOUTUBE_UPSTREAM_BURST_WINDOW_MS);
  minuteWindow = nextMinute.window;
  if (!nextMinute.ok) return false;
  const nextDay = take(dayWindow, YOUTUBE_UPSTREAM_DAILY, YOUTUBE_UPSTREAM_DAILY_WINDOW_MS);
  dayWindow = nextDay.window;
  return nextDay.ok;
}

function uploadsPlaylistId(channelId: string): string {
  return `UU${channelId.slice(2)}`;
}

function fromCache(channelId: string, entry: CacheEntry): YoutubeLatestResult {
  if (entry.errorStatus) {
    return entry.errorStatus === 404
      ? { ok: false, status: 404, error: UNKNOWN_CHANNEL_MESSAGE }
      : { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
  }
  return { ok: true, channelId, videos: entry.videos };
}

async function fetchUploads(channelId: string, apiKey: string): Promise<{ status: number; videos: string[] }> {
  const params = new URLSearchParams({
    part: 'contentDetails',
    maxResults: '5',
    playlistId: uploadsPlaylistId(channelId),
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: 'no-store' });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    return { status: name === 'TimeoutError' || name === 'AbortError' ? 408 : 503, videos: [] };
  }
  if (!res.ok) return { status: res.status, videos: [] };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { status: 502, videos: [] };
  }
  const items = (json as { items?: unknown }).items;
  const videos: string[] = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      const videoId = (item as { contentDetails?: { videoId?: unknown } }).contentDetails?.videoId;
      if (typeof videoId === 'string' && VIDEO_ID.test(videoId)) videos.push(videoId);
      if (videos.length >= 5) break;
    }
  }
  return { status: 200, videos };
}

function load(channelId: string, apiKey: string): Promise<YoutubeLatestResult> {
  const now = nowFn();
  const current = cache.get(channelId);
  if (current && current.freshUntil > now) return Promise.resolve(fromCache(channelId, current));

  const pending = inflight.get(channelId);
  if (pending) return pending;

  const run = (async (): Promise<YoutubeLatestResult> => {
    const cached = cache.get(channelId);
    const started = nowFn();
    if (!allowUpstream()) {
      if (cached && cached.errorStatus == null && cached.videos.length > 0) {
        remember(channelId, { ...cached, freshUntil: started + 60_000 });
        return { ok: true, channelId, videos: cached.videos };
      }
      remember(channelId, { videos: [], errorStatus: 503, freshUntil: started + 60_000 });
      return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
    }

    const upstream = await fetchUploads(channelId, apiKey);
    const fetchedAt = nowFn();
    if (upstream.status === 200) {
      remember(channelId, { videos: upstream.videos, errorStatus: null, freshUntil: fetchedAt + YOUTUBE_SUCCESS_TTL_MS });
      return { ok: true, channelId, videos: upstream.videos };
    }
    if (cached && cached.errorStatus == null && cached.videos.length > 0) {
      remember(channelId, { videos: cached.videos, errorStatus: null, freshUntil: fetchedAt + YOUTUBE_ERROR_TTL_MS });
      return { ok: true, channelId, videos: cached.videos };
    }
    const errorStatus: 404 | 503 = upstream.status === 404 ? 404 : 503;
    remember(channelId, { videos: [], errorStatus, freshUntil: fetchedAt + YOUTUBE_ERROR_TTL_MS });
    return errorStatus === 404
      ? { ok: false, status: 404, error: UNKNOWN_CHANNEL_MESSAGE }
      : { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
  })().finally(() => {
    inflight.delete(channelId);
  });

  inflight.set(channelId, run);
  return run;
}

export async function getYouTubeLatestVideos(rawChannelId: string): Promise<YoutubeLatestResult> {
  const channelId = normalizeYouTubeChannelId(rawChannelId);
  if (!channelId) return { ok: false, status: 400, error: REJECTED_MESSAGE };
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: UNAVAILABLE_MESSAGE };
  return load(channelId, apiKey);
}
