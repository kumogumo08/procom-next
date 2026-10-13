import 'server-only';

import { createHash } from 'node:crypto';

import { db } from '@/lib/firebase-admin';

import { nextRateCount } from './rateLimit';

function docId(key: string, windowMs: number, now: number): string {
  const bucket = Math.floor(now / windowMs);
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 20);
  return `${bucket}_${hash}`;
}

/** 複数インスタンスで同じ上限を共有する。失敗したら検索を通さない。 */
export async function allowDistributed(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const ref = db.collection('rateLimits').doc(docId(key, windowMs, now));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = typeof snap.data()?.count === 'number' ? snap.data()?.count : 0;
    const next = nextRateCount(current, limit);
    if (!next.ok) return false;
    tx.set(ref, { count: next.count, expiresAt: now + windowMs });
    return true;
  });
}
