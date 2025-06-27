import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // dbインスタンスの型はlibに応じて調整
// import { admin } from '@/lib/firebase-admin'; // 必要なら

export async function POST(
  req: NextRequest,
  { params }: { params: { uid: string } }
) {
  const { uid } = params;
  const data = await req.json();

  if (!data.profile || typeof data.profile !== 'object') {
    return NextResponse.json({ error: 'プロフィールデータが無効です' }, { status: 400 });
  }

  // 写真のバリデーション
  if (Array.isArray(data.profile.photos)) {
    for (const photo of data.profile.photos) {
      if (
        !photo.url || typeof photo.url !== 'string' ||
        !photo.url.startsWith('https://') ||
        typeof photo.position !== 'string'
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

