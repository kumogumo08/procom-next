// ファイル: app/api/account/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { firebaseDeletionPorts, runAccountDeletion } from '@/lib/accountDeletion';
import { clearSessionCookie, readSessionUid } from '@/lib/session';

export async function DELETE(req: NextRequest) {
  const uid = await readSessionUid(req);
  if (!uid) {
    return NextResponse.json({ message: 'ログインが必要です' }, { status: 401 });
  }

  try {
    const result = await runAccountDeletion(uid, firebaseDeletionPorts());
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    console.error('退会処理エラー:', code ?? (err instanceof Error ? err.name : 'error'));
    return NextResponse.json({ message: '退会処理に失敗しました' }, { status: 500 });
  }

  const res = NextResponse.json({ success: true });
  await clearSessionCookie(req, res);
  return res;
}
