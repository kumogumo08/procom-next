// app/api/users/route.ts — ユーザー一覧・検索（名前・肩書き）
import { db } from '@/lib/firebase';
import { NextRequest, NextResponse } from 'next/server';

/** category-users と同様の正規化（検索のゆらぎ吸収） */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ー−―─]/g, '')
    .replace(/\s/g, '')
    .replace(/[^\wぁ-んァ-ン一-龥]/g, '');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get('q')?.trim() ?? '';
  const qNorm = qRaw ? normalize(qRaw) : '';

  try {
    const snapshot = await db.collection('users').get();

    /** q なし: 全件返却（旧 GET 互換・他用途向け） */
    if (!qNorm) {
      const users = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          profile: data.profile || {},
        };
      });
      return NextResponse.json({ users });
    }

    const users: { uid: string; profile: Record<string, unknown> }[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const profile = data.profile || {};
      const name = typeof profile.name === 'string' ? profile.name : '';
      const title = typeof profile.title === 'string' ? profile.title : '';

      const nameNorm = normalize(name);
      const titleNorm = normalize(title);
      const combined = normalize(`${name} ${title}`);

      if (
        combined.includes(qNorm) ||
        nameNorm.includes(qNorm) ||
        titleNorm.includes(qNorm)
      ) {
        users.push({ uid: doc.id, profile });
      }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('❌ ユーザー一覧・検索エラー:', error);
    return NextResponse.json({ error: 'ユーザー情報の取得に失敗しました' }, { status: 500 });
  }
}
