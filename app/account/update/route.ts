import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase';
import { getSessionUID } from '@/lib/session';

const saltRounds = 10;

export async function POST(req: NextRequest) {
  const uid = await getSessionUID(req); 

  if (!uid) {
    return NextResponse.json({ error: 'ログインしていません' }, { status: 401 });
  }

  const { newUsername, newEmail, newPassword } = await req.json();

  try {
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'ユーザーが見つかりませんでした' }, { status: 404 });
    }

    const updates: Record<string, any> = {};

    if (newUsername) {
      updates.username = newUsername;
      // セッションのユーザー名も変更したい場合は、setSessionUIDなどを実装・呼び出す必要があります
    }

    if (newEmail) {
      updates.email = newEmail;
    }

    if (newPassword) {
      const hashed = await bcrypt.hash(newPassword, saltRounds);
      updates.password = hashed;
    }

    if (Object.keys(updates).length > 0) {
      await userDocRef.update(updates);
    }

    return NextResponse.json({ username: updates.username || userDoc.data()?.username });
  } catch (err) {
    console.error('アカウント更新エラー:', err);
    return NextResponse.json({ error: 'アカウント情報の更新に失敗しました' }, { status: 500 });
  }
}
