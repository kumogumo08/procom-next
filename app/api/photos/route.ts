// app/api/photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { noteUserListing } from '@/lib/listing/firestoreListing';
import { nextContentStamp } from '@/lib/profileContent';
import { getSessionUID } from '@/lib/session';

/** レガシー互換。呼び出し元が無い場合は削除可（PhotoSlider 等は /api/uploadPhotos + /api/user/[uid] を使用） */
export async function POST(req: NextRequest) {
  try {
    const sessionUid = await getSessionUID(req);
    if (!sessionUid) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    const body = await req.json();
    const { uid, photos } = body;

    if (!uid || typeof uid !== 'string' || !Array.isArray(photos)) {
      return NextResponse.json({ error: 'uidとphotosが必要です' }, { status: 400 });
    }

    if (sessionUid !== uid) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    for (const p of photos) {
      if (!p || typeof p !== 'object') {
        return NextResponse.json({ error: '写真データの形式が不正です' }, { status: 400 });
      }
      const url = (p as { url?: unknown }).url;
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        return NextResponse.json({ error: '写真URLが不正です' }, { status: 400 });
      }
      const pos = (p as { position?: unknown }).position;
      if (pos !== undefined && (typeof pos !== 'number' || Number.isNaN(pos))) {
        return NextResponse.json({ error: 'position が不正です' }, { status: 400 });
      }
    }

    const userRef = db.collection('users').doc(uid);
    const existingSnap = await userRef.get();
    const existingProfile =
      existingSnap.exists && existingSnap.data()?.profile && typeof existingSnap.data()?.profile === 'object'
        ? (existingSnap.data()?.profile as Record<string, unknown>)
        : {};
    const nextPhotos = photos.map((p: { url: string; position?: number }) => ({
      url: p.url,
      ...(typeof p.position === 'number' && !Number.isNaN(p.position)
        ? { position: Math.min(100, Math.max(0, p.position)) }
        : {}),
    }));
    const stamp = nextContentStamp(existingProfile, { ...existingProfile, photos: nextPhotos });
    await userRef.set(
      {
        profile: {
          photos: nextPhotos,
          ...(stamp != null ? { contentUpdatedAtMs: stamp } : {}),
        },
      },
      { merge: true }
    );
    await noteUserListing(uid);

    return NextResponse.json({ message: '✅ Firestoreに保存されました' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('🔥 保存失敗:', message);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
