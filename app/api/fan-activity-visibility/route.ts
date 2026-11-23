import { NextRequest, NextResponse } from 'next/server';

import { FAN_ACCOUNT_KIND, readUserAccountKind } from '@/lib/accountKind';
import { readUserSuspended } from '@/lib/accountSuspension';
import { rejectIfSuspended } from '@/lib/accountSuspensionGuard';
import { db } from '@/lib/firebase-admin';
import { FAN_ACTIVITY_PUBLIC_FIELD, parseFanActivityVisibility } from '@/lib/fanActivityVisibility';
import { resolveVerifiedSession } from '@/lib/session';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function POST(req: NextRequest) {
  const session = await resolveVerifiedSession(req);
  if (session instanceof NextResponse) return session;
  if (!session?.uid) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401, headers: PRIVATE });
  }
  const uid = session.uid;
  const suspended = await rejectIfSuspended(uid);
  if (suspended) return suspended;

  const parsed = parseFanActivityVisibility(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: PRIVATE });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists || snap.get('deletionPending') === true) {
        throw new Error('fan-activity-missing');
      }
      if (readUserSuspended(snap.data()) || readUserAccountKind(snap.data()) === FAN_ACCOUNT_KIND) {
        throw new Error('fan-activity-forbidden');
      }
      tx.update(userRef, { [FAN_ACTIVITY_PUBLIC_FIELD]: parsed.value });
    });
    return NextResponse.json({ fanActivityPublic: parsed.value }, { headers: PRIVATE });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'fan-activity-missing') {
      return NextResponse.json({ error: 'ユーザーが存在しません' }, { status: 404, headers: PRIVATE });
    }
    if (err instanceof Error && err.message === 'fan-activity-forbidden') {
      return NextResponse.json({ error: 'クリエイターだけ公開設定を変更できます' }, { status: 403, headers: PRIVATE });
    }
    console.error('fan activity visibility', err instanceof Error ? err.name : 'error');
    return NextResponse.json({ error: '公開設定を保存できませんでした' }, { status: 500, headers: PRIVATE });
  }
}
