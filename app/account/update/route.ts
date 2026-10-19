import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase';
import { noteUserListing } from '@/lib/listing/firestoreListing';
import { nextContentStamp } from '@/lib/profileContent';
import { getSessionUID, sessionOptions } from '@/lib/session';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/lib/session-types'; 

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

    const currentProfile = userDoc.data()?.profile;
    const updates: Record<string, any> = {};
    if (newUsername) updates['profile.name'] = newUsername;
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (newEmail) {
      // 🔍 形式チェック
      if (!isValidEmail(newEmail)) {
        return NextResponse.json({ error: '正しいメールアドレス形式で入力してください' }, { status: 400 });
      }

      // ✅ Firestore上にすでに同じメールアドレスが存在するか確認
      const emailQuery = await db.collection('users')
        .where('email', '==', newEmail)
        .get();

      // 他のユーザーが使っている場合はエラー（自分自身は除く）
      const emailUsedByOtherUser = emailQuery.docs.some(doc => doc.id !== uid);
      if (emailUsedByOtherUser) {
        return NextResponse.json({ error: 'このメールアドレスは既に使用されています' }, { status: 409 });
      }

      updates.email = newEmail;
    }
    if (newPassword) {
      const hashed = await bcrypt.hash(newPassword, saltRounds);
      updates.password = hashed;
    }

    if (Object.keys(updates).length > 0) {
      const currentName =
        currentProfile && typeof currentProfile === 'object' && typeof currentProfile.name === 'string'
          ? currentProfile.name
          : '';
      if (typeof newUsername === 'string' && newUsername.trim() && newUsername !== currentName) {
        const stamp = nextContentStamp(currentProfile, {
          ...(currentProfile && typeof currentProfile === 'object' ? currentProfile : {}),
          name: newUsername,
        });
        if (stamp != null) updates['profile.contentUpdatedAtMs'] = stamp;
      }
      await userDocRef.update(updates);
      if (newUsername) await noteUserListing(uid);
    }

    // 🔽 セッションを更新して保存
    const res = new NextResponse(); // レスポンスオブジェクトを用意
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.user = session.user || {};
    if (newEmail) session.user.email = newEmail;
    if (newUsername) session.user.name = newUsername;
    await session.save();

    return new NextResponse(
      JSON.stringify({ username: newUsername || userDoc.data()?.username }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...res.headers, // ここで Set-Cookie を含むヘッダーを維持
        },
      }
    );
  } catch (err) {
    console.error('アカウント更新エラー:', err);
    return NextResponse.json({ error: 'アカウント情報の更新に失敗しました' }, { status: 500 });
  }
}
