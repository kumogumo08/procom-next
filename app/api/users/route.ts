// app/api/users/route.ts — ユーザー検索（名前・肩書き）※一覧の全件返却は行わない
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

/** 一覧カード用: 先頭1枚のみ（過剰なプロフィール露出を抑える） */
function slimProfileForList(profile: Record<string, unknown>): {
  name: string;
  title: string;
  photos: unknown[];
} {
  const name = typeof profile.name === 'string' ? profile.name : '';
  const title = typeof profile.title === 'string' ? profile.title : '';
  const raw = Array.isArray(profile.photos) ? profile.photos : [];
  const first = raw[0];
  const photos: unknown[] = [];
  if (typeof first === 'string') {
    photos.push(first);
  } else if (first && typeof first === 'object' && first !== null && 'url' in first) {
    const u = (first as { url?: unknown; position?: unknown }).url;
    if (typeof u === 'string') {
      const pos = (first as { position?: unknown }).position;
      if (typeof pos === 'number' && !Number.isNaN(pos)) {
        photos.push({ url: u, position: Math.min(100, Math.max(0, pos)) });
      } else {
        photos.push({ url: u });
      }
    }
  }
  return { name, title, photos };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get('q')?.trim() ?? '';
  const qNorm = qRaw ? normalize(qRaw) : '';

  // 全件取得は廃止（未認証でのプロフィール一括漏えい防止）
  if (!qNorm) {
    return NextResponse.json(
      { error: '検索キーワード q が必要です' },
      { status: 400 }
    );
  }

  try {
    const snapshot = await db.collection('users').get();

    const users: { uid: string; profile: ReturnType<typeof slimProfileForList> }[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const profileRaw = (data.profile || {}) as Record<string, unknown>;
      const name = typeof profileRaw.name === 'string' ? profileRaw.name : '';
      const title = typeof profileRaw.title === 'string' ? profileRaw.title : '';
      const nameNorm = normalize(name);
      const titleNorm = normalize(title);
      const combined = normalize(`${name} ${title}`);

      if (
        combined.includes(qNorm) ||
        nameNorm.includes(qNorm) ||
        titleNorm.includes(qNorm)
      ) {
        users.push({ uid: doc.id, profile: slimProfileForList(profileRaw) });
      }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('❌ ユーザー一覧・検索エラー:', error);
    return NextResponse.json({ error: 'ユーザー情報の取得に失敗しました' }, { status: 500 });
  }
}
