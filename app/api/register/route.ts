import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { admin } from '@/lib/firebase';
import { setSessionCookie } from '@/lib/session';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebaseClient';

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

  if (!isValidPassword(password)) {
    return new NextResponse('パスワードは8〜32文字で、大文字・小文字・数字を含み、記号は使えません', { status: 400 });
  }

  const db = admin.firestore();

  // ユーザー名の重複チェック
  const usernameSnapshot = await db.collection('users').where('profile.name', '==', username).get();
  if (!usernameSnapshot.empty) {
    return new NextResponse('ユーザー名は既に使用されています', { status: 409 });
  }

  // メールアドレスの重複チェック（Firestore上）
  const emailSnapshot = await db.collection('users').where('email', '==', email).get();
  if (!emailSnapshot.empty) {
    return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
  }

  let uid = '';
  const hashed = await bcrypt.hash(password, 10);

  try {
    const auth = getAuth(firebaseApp);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    uid = userCredential.user.uid; // ✅ Firebase Auth の uid を取得
  } catch (err: any) {
    console.error('Firebase Auth 登録エラー:', err);
    return new NextResponse('Firebase Authentication 登録に失敗しました', { status: 500 });
  }

  // Firestore にプロフィール登録
  const userRef = db.collection('users').doc(uid);

  await userRef.set({
    uid,
    email: email.trim().toLowerCase(),
    password: hashed, // Firestoreには bcrypt で暗号化して保存（※必要に応じて省略可）
    profile: {
      name: username.trim(),
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
    username,
    user: { name: username },
  });

  return res;
}
