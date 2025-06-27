// app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { setSessionUID } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { uid } = await req.json();
  const res = NextResponse.json({ loggedIn: true });
  setSessionUID(uid);
  return res;
}