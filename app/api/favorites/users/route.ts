import { db } from '@/lib/firebase';
import { getSessionUID } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

interface FavoriteUser {
  uid: string;
  username: string;
  name: string;
  title: string;
  photoUrl?: string;
}

export async function GET(req: NextRequest, context: { params: { uid: string } }) {
  const { uid } = context.params;

  if (!uid) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  try {
    // ✅ 修正: ユーザードキュメントから favorites フィールドを取得
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.data();
    const favorites: string[] = userData?.favorites || [];

    if (favorites.length === 0) {
      return NextResponse.json([]); // お気に入りが空
    }

    const results: FavoriteUser[] = [];

    const chunks = chunkArray(favorites, 10);
    for (const chunk of chunks) {
      const snapshots = await db.getAll(
        ...chunk.map(uid => db.collection('users').doc(uid))
      );

      for (const snap of snapshots) {
        const data = snap.data();
        if (!data?.profile) continue;

        const profile = data.profile;
        const photos = profile.photos;
        let photoUrl = '';

        if (Array.isArray(photos)) {
          if (typeof photos[0] === 'string') {
            photoUrl = photos[0];
          } else if (typeof photos[0] === 'object' && photos[0]?.url) {
            photoUrl = photos[0].url;
          }
        }

        results.push({
          uid: snap.id,
          username: data.username || snap.id,
          name: profile.name || '',
          title: profile.title || '',
          photoUrl,
        });
      }
    }

    return NextResponse.json({ users: results }); 
  } catch (err) {
    console.error('❌ お気に入り取得エラー:', err);
    return NextResponse.json({ error: '内部エラー' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = await getSessionUID(req);

  if (!uid) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const { targetUid } = await req.json();

  if (!targetUid) {
    return NextResponse.json({ error: '削除対象が指定されていません' }, { status: 400 });
  }

  try {
    const userRef = db.collection('users').doc(uid);

    // Firestoreの配列から削除
    await userRef.update({
      favorites: admin.firestore.FieldValue.arrayRemove(targetUid),
    });

    return NextResponse.json({ message: '削除成功' });
  } catch (err) {
    console.error('❌ お気に入り削除エラー:', err);
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
  }
}

// 🔁 ユーティリティ関数
function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}
