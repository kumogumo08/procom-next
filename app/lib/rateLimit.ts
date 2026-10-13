export function nextRateCount(current: number, limit: number): { count: number; ok: boolean } {
  if (current >= limit) return { count: current, ok: false };
  return { count: current + 1, ok: true };
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/** 単一インスタンス向け。分散環境ではリクエスト数の上限にはならない。 */
export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function clientKey(header: string | null): string {
  const first = header?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : 'unknown';
}
