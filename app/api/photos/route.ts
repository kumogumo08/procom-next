// app/api/photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin'; // ✅ tsconfigで @/lib が "app/lib" を指していればこれでOK

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, photos } = body;

    if (!uid || !Array.isArray(photos)) {
      return NextResponse.json({ error: 'uidとphotosが必要です' }, { status: 400 });
    }

    console.log('📦 写真保存リクエスト:', { uid, photos });

    const userRef = db.collection('users').doc(uid);
    await userRef.set(
      {
        profile: {
          photos: photos.map((p: any) => ({
            url: p.url,
            ...(typeof p.position === 'number' && !Number.isNaN(p.position)
              ? { position: Math.min(100, Math.max(0, p.position)) }
              : {}),
          })),
        },
      },
      { merge: true }
    );

    return NextResponse.json({ message: '✅ Firestoreに保存されました' });
  } catch (err: any) {
    console.error('🔥 保存失敗:', err.message, err.stack); // 🔍 詳細なログ出力
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
