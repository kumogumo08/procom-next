// app/api/users/route.ts
import { db } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // ✅ プロフィール名があるユーザーのみ取得
    const snapshot = await db
      .collection('users')
      .where('profile.name', '!=', null)
      .get();

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        profile: data.profile || {},
      };
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('❌ ユーザー一覧取得エラー:', error);
    return NextResponse.json({ error: 'ユーザー一覧の取得に失敗しました' }, { status: 500 });
  }
}
