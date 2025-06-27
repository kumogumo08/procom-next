export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { admin } from '@/lib/firebase';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session'; // ✅ sessionOptionsを共通化
import type { SessionData } from '@/lib/session-types';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const db = admin.firestore();
  const snapshot = await db.collection('users').where('email', '==', email).get();

  if (snapshot.empty) {
    return NextResponse.json({ message: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  const userDoc = snapshot.docs[0];
  const user = userDoc.data();

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ message: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  const username = user.profile?.name ?? user.username ?? 'unknown';

  // ✅ ここでレスポンスオブジェクトを作成
const res = new NextResponse(JSON.stringify({ message: 'ログイン成功', uid: userDoc.id }), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
});

const session = await getIronSession<SessionData>(req, res, sessionOptions);
session.uid = userDoc.id;
session.username = username;
await session.save();
console.log('🍪 session:', session);
console.log('📫 res.headers.get("Set-Cookie"):', res.headers.get('Set-Cookie'));
console.log('📦 全ヘッダー:', JSON.stringify([...res.headers], null, 2));
return res;
}
