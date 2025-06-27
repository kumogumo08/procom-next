import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { verifySessionFromCookies } from '@/lib/session';

export async function POST(req: NextRequest) {
  // ✅ セッション確認
  const session = await verifySessionFromCookies();
  if (!session?.uid) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401 });
  }

  try {
    const { base64 } = await req.json();

    if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:image/')) {
      return NextResponse.json({ error: '画像のbase64データが不正です' }, { status: 400 });
    }

    const mimeMatch = base64.match(/^data:image\/(png|jpeg|jpg);base64,/);
    const extension = mimeMatch?.[1] ?? 'jpg'; // fallbackでjpg
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `photos/${session.uid}/${uuidv4()}.${extension}`;
    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: {
        contentType: `image/${extension}`,
      },
      public: true, // ✅ 公開URL有効化（必要に応じて）
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error('🔥 アップロード失敗:', err?.message || err);
    return NextResponse.json({ error: 'アップロード失敗' }, { status: 500 });
  }
}
