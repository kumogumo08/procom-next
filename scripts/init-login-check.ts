/**
 * 旧ログイン経路がセッションを発行しないこと。Firestore には接続しない。
 * 実行: npx tsx scripts/init-login-check.ts
 */
import { NextRequest } from 'next/server';
import { POST } from '@/api/init/login/route';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const req = new NextRequest('http://localhost/api/init/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ uid: 'other-user', username: 'other-user' }),
});

const res = await POST(req);
const body = await res.json();
const setCookie = res.headers.get('set-cookie') ?? '';

assert(res.status === 410, '旧ルートは 410 を返す');
assert(body.ok === false, '成功レスポンスを返さない');
assert(body.loggedIn !== true, 'ログイン済みと返さない');
assert(!setCookie.toLowerCase().includes('procom_session'), 'セッションCookieを発行しない');

console.log('init-login-check ok');
