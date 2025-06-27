// ファイル: app/api/account/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, bucket } from '@/lib/firebase';
import { getSessionUID } from '@/lib/session';

export async function DELETE(req: NextRequest) {
  const uid = await getSessionUID(req); 
  if (!uid) {
    return NextResponse.json({ message: 'ログインが必要です' }, { status: 401 });
  }

  try {
    // Firestoreのユーザーデータ削除
    await db.collection('users').doc(uid).delete();

    // Firebase Storageの写真も削除
    const [files] = await bucket.getFiles({ prefix: `photos/${uid}` });
    await Promise.all(files.map((file) => file.delete()));

    // セッション破棄はここではできないため、フロントで /api/logout へリダイレクト推奨
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ 退会処理エラー:', err);
    return NextResponse.json({ message: '退会処理に失敗しました' }, { status: 500 });
  }
}
