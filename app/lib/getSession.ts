import { SessionOptions } from 'iron-session';
import type { SessionData } from '@/lib/session-types';
import { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';

const sessionOptions: SessionOptions = {
  cookieName: 'procom_session',
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function getSession(req: NextRequest): Promise<SessionData | null> {
  try {
    const session = await getIronSession<SessionData>(req as any, sessionOptions);

    return session?.uid ? session : null;
  } catch (err) {
    console.error('❌ セッション取得失敗:', err);
    return null;
  }
}
