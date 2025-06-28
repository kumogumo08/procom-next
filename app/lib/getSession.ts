import { SessionOptions, getIronSession } from 'iron-session';
import type { SessionData } from '@/lib/session-types';

const sessionOptions: SessionOptions = {
  cookieName: 'procom_session',
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

// ✅ Next.js 15 対応の getSession
export async function getSession(req: Request): Promise<SessionData | null> {
  try {
    const res = new Response(); // ← 追加：iron-sessionのために必要
    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    return session?.uid ? session : null;
  } catch (err) {
    console.error('❌ セッション取得失敗:', err);
    return null;
  }
}
