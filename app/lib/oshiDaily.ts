import { createHash, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { admin, db } from '@/lib/firebase';
import { isProfilePublicWithOnboarding } from '@/lib/onboarding';
import { getSessionUID } from '@/lib/session';

export const MAX_OSHI_PER_DAY = 5;
export const OSHI_DAILY_COLLECTION = 'oshiDaily';
export const VISITOR_COOKIE_NAME = 'procom_visitor';

const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;
const UID_PATTERN = /^[A-Za-z0-9]{1,128}$/;
const VISITOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OshiActor = {
  actorKey: string;
  /** 新規発行したときだけ返す。既存Cookieはそのまま使う。 */
  issueVisitorId: string | null;
};

export type OshiCommitResult =
  | { ok: true; todayCount: number; totalCount: number }
  | { ok: false; reason: 'daily_limit'; todayCount: number }
  | { ok: false; reason: 'unavailable' };

function canReceiveOshi(snap: admin.firestore.DocumentSnapshot): boolean {
  if (!snap.exists) return false;
  if (snap.get('deletionPending') === true) return false;
  return isProfilePublicWithOnboarding(snap.get('profile'));
}

export function isSafeProfileUid(uid: string): boolean {
  return UID_PATTERN.test(uid);
}

export function getTokyoDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Asia/Tokyo の日付を取得できません');
  }
  const date = `${year}-${month}-${day}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Asia/Tokyo の日付を取得できません');
  }
  return date;
}

/** その日本時間の日付が終わったあと、TTL で消せるように余裕を持たせる。 */
export function getOshiDailyExpiresAt(date: string): Date {
  const start = new Date(`${date}T00:00:00+09:00`);
  return new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000);
}

export function visitorCookieOptions() {
  return {
    name: VISITOR_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE,
  };
}

function dailyDocId(date: string, actorKey: string): string {
  const hash = createHash('sha256').update(actorKey).digest('hex');
  return `${date}_${hash}`;
}

function readNonNegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function readTargets(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const targets: Record<string, number> = {};
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (!isSafeProfileUid(key)) continue;
    const next = readNonNegative(count);
    if (next > 0) targets[key] = next;
  }
  return targets;
}

/**
 * ログイン中は既存セッション UID を優先する。
 * 未ログイン時だけ httpOnly の匿名 ID を使う。ID 自体はドキュメントへ保存しない。
 */
export async function resolveOshiActor(req: NextRequest): Promise<OshiActor> {
  const sessionUid = await getSessionUID(req);
  if (sessionUid && isSafeProfileUid(sessionUid)) {
    return { actorKey: `user:${sessionUid}`, issueVisitorId: null };
  }

  const current = req.cookies.get(VISITOR_COOKIE_NAME)?.value ?? '';
  if (VISITOR_ID_PATTERN.test(current)) {
    return { actorKey: `visitor:${current}`, issueVisitorId: null };
  }

  const visitorId = randomUUID();
  return { actorKey: `visitor:${visitorId}`, issueVisitorId: visitorId };
}

export async function readOshiState(targetUid: string, actorKey: string, now = new Date()) {
  const date = getTokyoDateString(now);
  const [userSnap, dailySnap] = await Promise.all([
    db.collection('users').doc(targetUid).get(),
    db.collection(OSHI_DAILY_COLLECTION).doc(dailyDocId(date, actorKey)).get(),
  ]);
  const oshiCount = readNonNegative(userSnap.exists ? userSnap.data()?.oshiCount : 0);
  const todayCount = readNonNegative(dailySnap.exists ? dailySnap.data()?.totalCount : 0);
  return { oshiCount, todayCount };
}

export async function commitOshi(
  targetUid: string,
  actorKey: string,
  now = new Date()
): Promise<OshiCommitResult> {
  const date = getTokyoDateString(now);
  const dailyRef = db.collection(OSHI_DAILY_COLLECTION).doc(dailyDocId(date, actorKey));
  const userRef = db.collection('users').doc(targetUid);
  const expiresAt = admin.firestore.Timestamp.fromDate(getOshiDailyExpiresAt(date));

  try {
    return await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!canReceiveOshi(userSnap)) {
        return { ok: false as const, reason: 'unavailable' as const };
      }

      const dailySnap = await tx.get(dailyRef);
      const todayCount = readNonNegative(dailySnap.exists ? dailySnap.data()?.totalCount : 0);
      if (todayCount >= MAX_OSHI_PER_DAY) {
        return { ok: false as const, reason: 'daily_limit' as const, todayCount };
      }

      const targets = readTargets(dailySnap.exists ? dailySnap.data()?.targets : {});
      targets[targetUid] = (targets[targetUid] ?? 0) + 1;
      const nextToday = todayCount + 1;
      const prevTotal = readNonNegative(userSnap.get('oshiCount'));
      const nextTotal = prevTotal + 1;

      tx.set(
        dailyRef,
        {
          date,
          totalCount: nextToday,
          targets,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
        },
        { merge: true }
      );
      tx.update(userRef, { oshiCount: nextTotal });

      return { ok: true as const, todayCount: nextToday, totalCount: nextTotal };
    });
  } catch (error: unknown) {
    const code = (error as { code?: unknown }).code;
    if (code === 5 || code === 'not-found') {
      return { ok: false, reason: 'unavailable' };
    }
    throw error;
  }
}
