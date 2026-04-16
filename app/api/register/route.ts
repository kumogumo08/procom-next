import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { admin } from '@/lib/firebase';
import { setSessionCookie } from '@/lib/session';

function isValidPassword(password: string): boolean {
  const lengthOK = password.length >= 8 && password.length <= 32;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return lengthOK && hasUpper && hasLower && hasNumber && !hasSymbol;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { username, email, password }: { username: string; email: string; password: string } = await req.json();

  if (!username || !email || !password) {
    return new NextResponse('すべての項目を入力してください', { status: 400 });
  }

  if (!isValidEmail(email)) {
    return new NextResponse('メールアドレスの形式が正しくありません', { status: 400 });
  }

  if (!isValidPassword(password)) {
    return new NextResponse('パスワードは8〜32文字で、大文字・小文字・数字を含み、記号は使えません', { status: 400 });
  }

  const db = admin.firestore();

  // ユーザー名の重複チェック（Firestore 上）
  const usernameSnapshot = await db.collection('users').where('profile.name', '==', username).get();
  if (!usernameSnapshot.empty) {
    return new NextResponse('ユーザー名は既に使用されています', { status: 409 });
  }

  // メールアドレスの重複チェック（Firestore 上）
  const emailSnapshot = await db.collection('users').where('email', '==', email).get();
  if (!emailSnapshot.empty) {
    return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
  }

  let uid = '';
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();
  const hashed = await bcrypt.hash(password, 10);

  try {
    // 追加の重複確認（Auth 側）
    try {
      const existingUser = await admin.auth().getUserByEmail(normalizedEmail);
      if (existingUser) {
        return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
      }
    } catch (lookupErr: any) {
      // auth/user-not-found 以外のエラーはログだけ残して処理継続
      if (lookupErr?.code && lookupErr.code !== 'auth/user-not-found') {
        console.error('admin.auth().getUserByEmail で予期せぬエラー:', lookupErr);
      }
    }

    const userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: normalizedUsername,
    });
    uid = userRecord.uid;
  } catch (err: any) {
    console.error('Firebase Admin Auth 登録エラー:', err);

    const code = err?.code as string | undefined;
    if (code === 'auth/email-already-exists') {
      return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
    }
    if (code === 'auth/invalid-email') {
      return new NextResponse('メールアドレスの形式が正しくありません', { status: 400 });
    }
    if (code === 'auth/operation-not-allowed') {
      return new NextResponse('現在、この操作は許可されていません', { status: 500 });
    }

    return new NextResponse('Firebase Authentication 登録に失敗しました', { status: 500 });
  }

  // Firestore にプロフィール登録
  const userRef = db.collection('users').doc(uid);

  await userRef.set({
    uid,
    email: normalizedEmail,
    password: hashed, // Firestoreには bcrypt で暗号化して保存（※必要に応じて省略可）
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    profile: {
      name: normalizedUsername,
      title: '',
      bio: '',
      photos: [],
      youtubeChannelId: '',
      instagramPostUrl: '',
      xUsername: '',
      tiktokUrls: [],
      calendarEvents: [],
    },
  });

  // セッション & レスポンス
  const redirectTo = `/user/${uid}`;
  const res = NextResponse.json({ success: true, redirectTo });

  await setSessionCookie(req, res, {
    uid,
    username: normalizedUsername,
    user: { name: normalizedUsername },
  });

  return res;
}
