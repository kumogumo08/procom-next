export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import type { SessionData } from '@/lib/session-types';

// ✅ Firebaseクライアント初期化
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
};
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  try {
    // ✅ Firebase Auth でログイン
    const auth = getAuth(firebaseApp);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // ✅ Firestore からプロフィールを取得
    const admin = (await import('@/lib/firebase')).admin;
    const db = admin.firestore();
    const doc = await db.collection('users').doc(uid).get();
    const profileData = doc.exists ? doc.data()?.profile : null;
    const username = profileData?.name ?? 'unknown';

    // ✅ セッション保存 + レスポンス返却
    const res = new NextResponse(JSON.stringify({ message: 'ログイン成功', uid }));
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.uid = uid;
    session.username = username;
    await session.save();

    return res;

  } catch (error: any) {
    console.error('ログインエラー:', error);
    return NextResponse.json({ message: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }
}
