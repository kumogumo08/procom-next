import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import { verifySessionFromRequest } from '@/lib/session';

initializeFirebaseAdmin();
const bucket = getStorage().bucket();

export async function POST(req: NextRequest) {
  const session = await verifySessionFromRequest(req);
  if (!session?.uid) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'ファイルが無効です' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: '対応していないファイル形式です' }, { status: 415 });
    }

    if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: 'ファイルサイズが大きすぎます（4MB以下にしてください）' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1]; // 'jpeg'など
    const filename = `banners/${session.uid}/${uuidv4()}.${ext}`;
    const storageFile = bucket.file(filename);

    await storageFile.save(buffer, {
      metadata: { contentType: file.type },
      public: true,
    });

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error('❌ 画像アップロードエラー:', err);
    return NextResponse.json({ error: '画像アップロードに失敗しました' }, { status: 500 });
  }
}
