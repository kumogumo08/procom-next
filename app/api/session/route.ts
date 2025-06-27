// ✅ 修正後
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import type { SessionData } from '@/lib/session-types';

export async function GET(req: NextRequest) {
  const res = new NextResponse(); // ← 型を満たすために必要
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session?.uid || !session?.username) {
    return NextResponse.json({ loggedIn: false });
  }

  return NextResponse.json({
    loggedIn: true,
    uid: session.uid,
    username: session.username,
  });
}

