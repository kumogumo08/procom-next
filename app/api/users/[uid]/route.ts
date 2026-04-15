import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getSessionUID } from '@/lib/session';

/** リポジトリ内に fetch 呼び出し元なし。/api/user/[uid] へ統合済みなら削除候補 */
export async function POST(req: NextRequest, props: { params: Promise<{ uid: string }> }) {
  const sessionUid = await getSessionUID(req);
  if (!sessionUid) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const params = await props.params;
  const { uid } = params;

  if (sessionUid !== uid) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const data = await req.json();

  if (!data.profile || typeof data.profile !== 'object') {
    return NextResponse.json({ error: 'プロフィールデータが無効です' }, { status: 400 });
  }

  // 写真のバリデーション
  if (Array.isArray(data.profile.photos)) {
    for (const photo of data.profile.photos) {
      if (
        !photo.url ||
        typeof photo.url !== 'string' ||
        !photo.url.startsWith('https://')
      ) {
        return NextResponse.json({ error: '写真データが不正です' }, { status: 400 });
      }
    }
  }

  try {
    await db.collection('users').doc(uid).set(
      { profile: { photos: data.profile.photos } },
      { merge: true }
    );

    return NextResponse.json({ message: 'Firebaseに保存しました', uid });
  } catch (error: any) {
    console.error('Firestore保存エラー:', error.message || error);
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}

