import { NextRequest, NextResponse } from 'next/server';
import { firebaseDeletionPorts, runAccountDeletion, type AccountDeletionPorts } from '@/lib/accountDeletion';
import { assertServerEmulator } from '@/lib/firebaseEmulator';
import { readSessionUid } from '@/lib/session';

const STEPS = new Set(['unavailable', 'deleteAuth', 'deleteStorage', 'deleteUserDoc']);

/** Emulator の失敗注入だけ。本番設定では 404。セッションの UID 以外は消さない。 */
export async function POST(req: NextRequest) {
  if (process.env.PROCOM_EMULATOR !== '1') {
    return NextResponse.json({ message: 'not found' }, { status: 404 });
  }
  try {
    const isolated = assertServerEmulator();
    if (isolated.projectId !== 'demo-procom-local') {
      return NextResponse.json({ message: 'not found' }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ message: 'not found' }, { status: 404 });
  }

  const uid = await readSessionUid(req);
  if (!uid) return NextResponse.json({ message: 'ログインが必要です' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { step?: unknown } | null;
  const step = body?.step;
  if (typeof step !== 'string' || !STEPS.has(step)) {
    return NextResponse.json({ message: 'bad step' }, { status: 400 });
  }

  const ports = firebaseDeletionPorts();
  const wrapped: AccountDeletionPorts = { ...ports };
  if (step === 'unavailable') wrapped.authState = async () => 'unavailable';
  if (step === 'deleteAuth') {
    wrapped.deleteAuth = async () => {
      throw new Error('injected-auth');
    };
  }
  if (step === 'deleteStorage') {
    wrapped.deleteStorage = async () => {
      throw new Error('injected-storage');
    };
  }
  if (step === 'deleteUserDoc') {
    wrapped.deleteUserDoc = async () => {
      throw new Error('injected-firestore');
    };
  }

  try {
    const result = await runAccountDeletion(uid, wrapped);
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    console.error('退会失敗の検証:', code ?? (err instanceof Error ? err.name : 'error'));
    return NextResponse.json({ message: '退会処理に失敗しました' }, { status: 500 });
  }
  return NextResponse.json({ message: '退会処理に失敗しました' }, { status: 500 });
}
