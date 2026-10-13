const ERROR_LIMIT = 180;

/** 監視APIが返す項目だけ。秘密や任意フィールドは落とす。 */
export function publicHealth(data: Record<string, unknown> | undefined): {
  lastFinishedAt: string | null;
  lastOkAt: string | null;
  lastError: string;
  processed: number;
} {
  const source = data ?? {};
  return {
    lastFinishedAt: typeof source.lastFinishedAt === 'string' ? source.lastFinishedAt : null,
    lastOkAt: typeof source.lastOkAt === 'string' ? source.lastOkAt : null,
    lastError: sanitizeHealthError(source.lastError),
    processed: typeof source.processed === 'number' ? source.processed : 0,
  };
}

export function sanitizeHealthError(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/private_key/gi, '[redacted]')
    .replace(/LISTING_SYNC_SECRET/gi, '[redacted]')
    .slice(0, ERROR_LIMIT);
}
