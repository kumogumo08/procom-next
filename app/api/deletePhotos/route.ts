// app/api/deletePhotos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase';
import { getSessionUID } from '@/lib/session';

export async function POST(req: NextRequest) {
  const uid = await getSessionUID(req); 

  if (!uid) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 403 });
  }

  const body = await req.json();
  const { urls } = body;

  if (!Array.isArray(urls)) {
    return NextResponse.json({ error: '不正な形式です' }, { status: 400 });
  }

  const deletedSet = new Set<string>();

  try {
    for (const url of urls) {
      const match = decodeURIComponent(url).match(/\/o\/(.+)\?alt=media/);
      if (match && match[1]) {
        const filePath = match[1];

        if (!filePath.startsWith(`photos/${uid}/`)) {
          console.warn(`⚠️ 不正なファイルパス: ${filePath}`);
          continue;
        }

        if (!deletedSet.has(filePath)) {
          await bucket.file(filePath).delete();
          deletedSet.add(filePath);
          console.log(`🗑️ 削除完了: ${filePath}`);
        }
      }
    }

    return NextResponse.json({ message: '削除完了' });
  } catch (err: any) {
    console.error('❌ 写真削除エラー:', err);
    return NextResponse.json({ error: '写真の削除に失敗しました' }, { status: 500 });
  }
}
