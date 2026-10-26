import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { firebaseDeletionPorts, resumeIncompleteAccountDeletions, type AccountDeletionPorts } from '@/lib/accountDeletion';
import { assertServerEmulator } from '@/lib/firebaseEmulator';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

function resumeSecret(): string | null {
  const secret = process.env.ACCOUNT_DELETION_RESUME_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

function authorized(req: NextRequest, secret: string): boolean {
  const header = req.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const token = header.slice(prefix.length);
  const actual = Buffer.from(token);
  const wanted = Buffer.from(secret);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

function localEmulator(): boolean {
  if (process.env.PROCOM_EMULATOR !== '1') return false;
  try {
    return assertServerEmulator().projectId === 'demo-procom-local';
  } catch {
    return false;
  }
}

/** 署名済みの未完了記録だけを後処理する。UID は受け取らない。 */
export async function POST(req: NextRequest) {
  const secret = resumeSecret();
  if (!secret) {
    return NextResponse.json({ error: '退会後処理の認証設定がありません' }, { status: 503, headers: PRIVATE });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: PRIVATE });
  }

  const body = (await req.json().catch(() => null)) as { fault?: unknown } | null;
  const fault = body?.fault;
  if (fault != null && !localEmulator()) {
    return NextResponse.json({ error: 'bad request' }, { status: 400, headers: PRIVATE });
  }

  const ports: AccountDeletionPorts = firebaseDeletionPorts();
  if (fault === 'deleteStorage') {
    ports.deleteStorage = async () => {
      throw new Error('injected-sweep-storage');
    };
  } else if (fault === 'deleteUserDoc') {
    ports.deleteUserDoc = async () => {
      throw new Error('injected-sweep-firestore');
    };
  } else if (fault != null) {
    return NextResponse.json({ error: 'bad fault' }, { status: 400, headers: PRIVATE });
  }

  try {
    const result = await resumeIncompleteAccountDeletions(ports);
    if (result.unavailable) {
      console.error('退会後処理を見送り: 署名設定がありません');
      return NextResponse.json({ error: '退会後処理の署名設定がありません' }, { status: 503, headers: PRIVATE });
    }
    console.log(
      '退会後処理:',
      `completed=${result.completed}`,
      `skipped=${result.skipped}`,
      `failed=${result.failed}`,
      `skippedLock=${result.skippedLock}`
    );
    return NextResponse.json(
      {
        completed: result.completed,
        skipped: result.skipped,
        failed: result.failed,
        skippedLock: result.skippedLock,
      },
      { headers: PRIVATE }
    );
  } catch (err: unknown) {
    console.error('退会後処理に失敗:', err instanceof Error ? err.name : 'error');
    return NextResponse.json({ error: '退会後処理に失敗しました' }, { status: 500, headers: PRIVATE });
  }
}
