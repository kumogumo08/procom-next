import { cookies } from 'next/headers';
import { getIronSession, IronSession } from 'iron-session';
import type { SessionOptions } from 'iron-session';
import type { SessionData } from './session-types';
import { NextResponse, NextRequest } from 'next/server';

// ✅ セッションオプション
export const sessionOptions: SessionOptions = {
  cookieName: 'procom_session',
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: undefined, // セッション終了で削除されるクッキー
  },
};

// ✅ App Router互換: リクエスト風オブジェクトを手動構成
async function createRequestLikeFromCookies(): Promise<{ headers: { get(name: string): string | null } }> {
  const cookieStore = await cookies();
  const cookieString = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'cookie' ? cookieString : null,
    },
  };
}

// ✅ セッション取得（サーバー側）
export async function verifySession(): Promise<IronSession<SessionData> | null> {
  try {
    // createRequestLikeFromCookies() が不要になったので削除
    throw new Error('verifySession() は App Router では非推奨です。verifySessionFromRequest(req) を使用してください。');
  } catch (err) {
    console.error('❌ verifySession 失敗:', err);
    return null;
  }
}

// ✅ API Route 内で使用（NextRequest 経由）
export async function verifySessionFromRequest(
  req: NextRequest
): Promise<IronSession<SessionData> | null> {
  try {
    const session = await getIronSession<SessionData>(
      req,
      new NextResponse(),
      sessionOptions
    );
    return session?.uid ? session : null;
  } catch (err) {
    console.error('❌ verifySessionFromRequest 失敗:', err);
    return null;
  }
}

// ✅ UIDだけを返す簡易関数
export async function getSessionUID(
  req: NextRequest
): Promise<string | null> {
  const session = await verifySessionFromRequest(req);
  return session?.uid ?? null;
}

// ✅ セッションをレスポンスに保存（ログイン時など）
export async function setSessionCookie(
  req: NextRequest,
  res: NextResponse,
  data: SessionData
): Promise<NextResponse> {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.uid = data.uid;
  session.username = data.username;
  await session.save();
  return res;
}

// ✅ エクスポートエイリアス（必要なら）
export { verifySession as verifySessionFromCookies };