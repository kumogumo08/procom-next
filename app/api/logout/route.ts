import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import type { SessionData } from '@/lib/session-types';

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  await session.destroy(); // ✅ iron-session のセッション破棄

  return NextResponse.redirect(
    new URL('/top', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
  );
}
