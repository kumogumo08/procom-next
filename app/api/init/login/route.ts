// app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { uid, username } = await req.json();

  const res = NextResponse.json({ loggedIn: true });

  // UIDとユーザー名をセッションに保存
  await setSessionCookie(req, res, {
    uid,
    username,
    user: { name: username },
  });

  return res;
}