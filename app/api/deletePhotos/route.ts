// app/api/deletePhotos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase';
import { ownedReplacementPhotoPath } from '@/lib/ownedPhotoPath';
import { schedulePhotoRetention } from '@/lib/photoGc';
import { resolveSessionUid } from '@/lib/session';

export async function POST(req: NextRequest) {
  const uid = await resolveSessionUid(req);
  if (uid instanceof NextResponse) return uid;

  if (!uid) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 403 });
  }

  const body = await req.json();
  const { urls } = body;

  if (!Array.isArray(urls)) {
    return NextResponse.json({ error: '不正な形式です' }, { status: 400 });
  }

  const queued = new Set<string>();

  try {
    for (const url of urls) {
      const objectPath = ownedReplacementPhotoPath(url, uid, bucket.name);
      if (!objectPath) {
        console.warn('写真の削除対象を確認できません');
        continue;
      }
      if (queued.has(objectPath)) continue;
      queued.add(objectPath);
      await schedulePhotoRetention(uid, objectPath);
    }

    return NextResponse.json({ message: '削除完了' });
  } catch (err: unknown) {
    console.error('写真削除エラー:', err instanceof Error ? err.name : 'error');
    return NextResponse.json({ error: '写真の削除に失敗しました' }, { status: 500 });
  }
}
