// /api/category-users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase';

initializeFirebaseAdmin();
const db = getFirestore();

type CategoryUserRow = {
  uid: string;
  profile: {
    photos?: unknown;
    title?: string;
    [key: string]: unknown;
  };
};

/** profile.photos の先頭に有効な URL があるか（string / { url } 両対応） */
function hasValidProfilePhoto(photos: unknown): boolean {
  if (!Array.isArray(photos) || photos.length === 0) return false;
  const raw = photos[0];
  if (typeof raw === 'string') return raw.trim().length > 0;
  if (raw && typeof raw === 'object' && 'url' in raw) {
    const u = (raw as { url?: unknown }).url;
    return typeof u === 'string' && u.trim().length > 0;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const withPhotos = searchParams.get('withPhotos') === '1';

  try {
    const snapshot = await db.collection('users').get();

    const matchedUsers: CategoryUserRow[] = [];

    // 正規化関数：ひらがな・カタカナ・記号・長音などを揃える
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[ー−―─]/g, '') // 長音のゆらぎ除去
        .replace(/\s/g, '')       // 全角/半角スペース除去
        .replace(/[^\wぁ-んァ-ン一-龥]/g, ''); // 記号除去（必要に応じて調整）

    const categoryNorm = normalize(category);

    snapshot.forEach((doc) => {
      const data = doc.data();
      const profile = data.profile || {};
      const title = profile.title || '';

      if (category === 'new') {
        matchedUsers.push({ uid: doc.id, profile }); // 新規登録者は全件対象
      } else {
        const titleNorm = normalize(title);
        if (titleNorm.includes(categoryNorm)) {
          matchedUsers.push({ uid: doc.id, profile });
        }
      }
    });

    // withPhotos=1 のときだけ画像ありユーザーに絞ってから件数制限（表示件数の不足を防ぐ）
    const candidates = withPhotos
      ? matchedUsers.filter((u) => hasValidProfilePhoto(u.profile?.photos))
      : matchedUsers;

    const shuffled = candidates.sort(() => 0.5 - Math.random()).slice(0, 12);

    return NextResponse.json({ users: shuffled });
  } catch (error) {
    console.error('🔥 category-users エラー:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
