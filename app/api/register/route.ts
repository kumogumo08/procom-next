import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
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

  if (!isValidPassword(password)) {
    return new NextResponse('パスワードは8〜32文字で、大文字・小文字・数字を含み、記号は使えません', { status: 400 });
  }

  const db = admin.firestore();

  const usernameSnapshot = await db.collection('users').where('profile.name', '==', username).get();
  if (!usernameSnapshot.empty) {
    return new NextResponse('ユーザー名は既に使用されています', { status: 409 });
  }

  const emailSnapshot = await db.collection('users').where('email', '==', email).get();
  if (!emailSnapshot.empty) {
    return new NextResponse('メールアドレスは既に使用されています', { status: 409 });
  }

  const uid = uuidv4();
  const hashed = await bcrypt.hash(password, 10);
  const userRef = db.collection('users').doc(uid);

  await userRef.set({
    uid,
    email: email.trim().toLowerCase(),
    password: hashed,
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

  // ✅ res を作ってから setSessionCookie に渡す
const redirectTo = `/user/${uid}`;
const res = NextResponse.json({ success: true, redirectTo });

// ✅ セッションを res に反映（ここでクッキーがセットされる）
await setSessionCookie(req, res, {
  uid,
  username,
  user: { name: username }, // ✅ 型に合った渡し方！
});

// ✅ そのまま返す
return res;// ✅ JSONで返す

}
