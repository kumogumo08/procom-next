'use client';

type UserApiResponse = {
  profile?: any;
  uid?: string;
  message?: string;
  error?: string;
};

const inflight = new Map<string, Promise<UserApiResponse>>();
const cache = new Map<string, { at: number; data: UserApiResponse }>();

// dev での「同一 uid への多重 GET」を減らす目的。
// 動作（取得内容）は変えず、短時間の重複リクエストだけ抑止する。
const CACHE_TTL_MS = 3_000;

export async function fetchUserApi(
  uid: string,
  opts?: { caller?: string; reason?: string; noCache?: boolean }
): Promise<UserApiResponse> {
  if (!uid) return {};

  const key = uid;
  const now = Date.now();

  if (!opts?.noCache) {
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[fetchUserApi] cache hit', { uid, caller: opts?.caller, reason: opts?.reason });
      }
      return hit.data;
    }
  }

  const existing = inflight.get(key);
  if (existing) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[fetchUserApi] dedupe inflight', { uid, caller: opts?.caller, reason: opts?.reason });
    }
    return existing;
  }

  const p = (async () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[fetchUserApi] fetch start', { uid, caller: opts?.caller, reason: opts?.reason });
    }
    const res = await fetch(`/api/user/${uid}`, { method: 'GET' });
    const data = (await res.json().catch(() => ({}))) as UserApiResponse;
    cache.set(key, { at: Date.now(), data });
    return data;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, p);
  return p;
}

