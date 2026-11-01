/**
 * お仕事用メールアドレスの保存と mailto。
 * demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx scripts/onboarding-emulator/contact-email-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { contactMailtoHref } from '../../app/components/ContactButtonBlock';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const suffix = Date.now().toString(36);
const PLUS = `work+tag${suffix}@sub.example.com`;
const KEPT = `keep${suffix}@example.com`;

type Status = 'pass' | 'fail';
const rows: Array<{ item: string; status: Status; note: string }> = [];

function row(item: string, ok: boolean, note: string): void {
  rows.push({ item, status: ok ? 'pass' : 'fail', note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${item}: ${note}`);
}

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

function stopChild(child: ChildProcess | null): void {
  if (!child || child.exitCode != null) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

type CookieJar = Map<string, string>;

function remember(res: Response, jar: CookieJar): void {
  const lines = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const line of lines) {
    const pair = line.split(';')[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (!value) jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(
  path: string,
  jar: CookieJar,
  init: RequestInit = {}
): Promise<{ status: number; text: string }> {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set('cookie', cookie);
  const res = await fetch(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' });
  remember(res, jar);
  return { status: res.status, text: await res.text() };
}

async function signIn(email: string, password: string): Promise<string> {
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { firebaseApp } = await import('../../app/lib/firebaseClient');
  const auth = getAuth(firebaseApp);
  const emulator = (auth as unknown as { config?: { emulator?: { url?: string } } }).config?.emulator?.url ?? '';
  if (!emulator.startsWith('http://127.0.0.1:9099') && !emulator.startsWith('http://localhost:9099')) {
    throw new Error('Auth Emulator 以外へのサインインは中止しました');
  }
  if (firebaseApp.options.projectId !== EMULATOR.projectId) {
    throw new Error('クライアントの project id がローカルテスト用ではありません');
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.getIdToken();
}

async function main(): Promise<number> {
  if (process.env.PROCOM_EMULATOR !== '1' || process.env.FIREBASE_PROJECT_ID !== 'demo-procom-local') {
    console.error('Emulator 隔離が無効です。テストは開始しません。');
    return 1;
  }
  if (process.env.FIREBASE_KEY_PATH) {
    console.error('鍵パスが空ではありません。テストは開始しません。');
    return 1;
  }

  const poisoned = `${KEPT}?bcc=evil${suffix}@example.com`;
  row('14. 不正値のmailtoを作らない', contactMailtoHref(poisoned) == null && contactMailtoHref(PLUS)?.startsWith(`mailto:${PLUS}?subject=`) === true, PLUS);

  const ports = [9099, 8282, 9199, 4401];
  const already = await Promise.all(ports.map((port) => portOpen(port)));
  let emulator: ChildProcess | null = null;
  if (!already.every(Boolean)) {
    emulator = spawn(
      'npx',
      ['firebase', 'emulators:start', '--only', 'auth,firestore,storage', '--project', EMULATOR.projectId, '--config', 'scripts/onboarding-emulator/firebase.json'],
      { cwd: join(import.meta.dirname, '../..'), shell: true, stdio: 'ignore' }
    );
    const deadline = Date.now() + 90_000;
    let ready = false;
    while (Date.now() < deadline) {
      const open = await Promise.all(ports.map((port) => portOpen(port)));
      if (open.every(Boolean)) {
        ready = true;
        break;
      }
      if (emulator.exitCode != null) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) {
      stopChild(emulator);
      console.error('Emulator が起動しませんでした。');
      return 1;
    }
  }

  const hub = await fetch(`http://${EMULATOR.hubHost}/emulators`);
  const hubBody = hub.ok ? ((await hub.json()) as Record<string, { host?: string; port?: number }>) : {};
  const localHub = (name: string, port: number) => hubBody[name]?.host === '127.0.0.1' && hubBody[name]?.port === port;
  if (!localHub('auth', 9099) || !localHub('firestore', 8282) || !localHub('storage', 9199)) {
    console.error('Hub の接続先がローカル Emulator ではありません。');
    stopChild(emulator);
    return 1;
  }

  const { admin, bucket, db } = await import('../../app/lib/firebase');
  if (admin.app().options.projectId !== 'demo-procom-local') {
    console.error('Admin SDK の接続先が demo-procom-local ではありません。中止しました。');
    stopChild(emulator);
    return 1;
  }
  if ((globalThis as { __procomEmulatorCredential?: boolean }).__procomEmulatorCredential !== true) {
    console.error('Emulator 用の資格情報が使われていません。中止しました。');
    stopChild(emulator);
    return 1;
  }

  const email = `mail-${suffix}@demo.local`;
  const createdAuth: string[] = [];
  const createdDocs: string[] = [];
  let next: ChildProcess | null = null;

  try {
    if (await portOpen(EMULATOR.nextPort)) {
      console.error('127.0.0.1:3100 が使用中です。テストは開始しません。');
      return 1;
    }
    next = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
      cwd: join(import.meta.dirname, '../..'),
      env: process.env,
      shell: true,
      stdio: 'ignore',
    });
    const deadline = Date.now() + 120_000;
    let booted = false;
    while (Date.now() < deadline) {
      if (next.exitCode != null) break;
      try {
        const res = await fetch(`${ORIGIN}/login`, { redirect: 'manual' });
        if (res.status < 500) {
          booted = true;
          break;
        }
      } catch {
        // 起動待ち
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!booted) {
      console.error('隔離した Next が起動しませんでした。');
      return 1;
    }

    const user = await admin.auth().createUser({ email, password: PASSWORD, displayName: 'mail' });
    createdAuth.push(user.uid);
    createdDocs.push(user.uid);
    await db.collection('users').doc(user.uid).set({
      profile: { name: `Before${suffix}`, title: '肩書', emailForContact: KEPT },
    });
    const poisonId = `poison${suffix}`;
    createdDocs.push(poisonId);
    await db.collection('users').doc(poisonId).set({
      profile: { name: `Poison${suffix}`, title: '肩書', emailForContact: poisoned },
    });

    const jar: CookieJar = new Map();
    const logged = await request('/api/session/login', jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: await signIn(email, PASSWORD) }),
    });
    if (logged.status !== 200) throw new Error(`ログイン失敗 ${logged.status}`);

    async function profileOf(): Promise<{ name: string; email: string }> {
      const snap = await db.collection('users').doc(user.uid).get();
      const profile = (snap.get('profile') ?? {}) as { name?: unknown; emailForContact?: unknown };
      return {
        name: typeof profile.name === 'string' ? profile.name : '',
        email: typeof profile.emailForContact === 'string' ? profile.emailForContact : '',
      };
    }

    async function post(profile: Record<string, unknown>): Promise<{ status: number; text: string }> {
      return request(`/api/user/${user.uid}`, jar, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
    }

    const normal = await post({ emailForContact: `plain${suffix}@example.com` });
    row('1. 正常なメール', normal.status === 200 && (await profileOf()).email === `plain${suffix}@example.com`, `HTTP ${normal.status}`);

    const plus = await post({ emailForContact: PLUS });
    row('2. +付きメール', plus.status === 200 && (await profileOf()).email === PLUS, `HTTP ${plus.status}`);

    const blank = await post({ emailForContact: '' });
    row('3. 空欄', blank.status === 200 && (await profileOf()).email === '', `HTTP ${blank.status}`);

    const trimmed = await post({ emailForContact: `  ${PLUS}  ` });
    row('4. 前後の空白をtrim', trimmed.status === 200 && (await profileOf()).email === PLUS, `HTTP ${trimmed.status} saved=${(await profileOf()).email}`);

    const beforeReject = await profileOf();
    const rejects: Array<[string, string]> = [
      ['5. ?を拒否', `${PLUS}?bcc=evil@example.com`],
      ['6. 改行を拒否', `${PLUS}\nBcc:evil@example.com`],
      ['6. タブを拒否', `\t${PLUS}`],
      ['7. 複数アドレスを拒否', `${PLUS},${PLUS}`],
      ['8. mailtoを拒否', `mailto:${PLUS}`],
      ['長い文字列を拒否', `${'a'.repeat(250)}@example.com`],
      ['URLを拒否', 'https://example.com/user@host'],
    ];
    for (const [label, value] of rejects) {
      const denied = await post({ name: `Changed${suffix}`, bio: 'should-not-save', emailForContact: value });
      const after = await profileOf();
      row(
        label,
        denied.status === 400 &&
          denied.text.includes('お仕事用メールアドレスの形式を確認してください') &&
          after.email === beforeReject.email &&
          after.name === beforeReject.name,
        `HTTP ${denied.status}`
      );
    }

    const partial = await post({
      name: `Changed${suffix}`,
      bio: 'should-not-save',
      emailForContact: 'not-an-email',
      photos: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAg='] ,
    });
    const [files] = await bucket.getFiles({ prefix: `photos/${user.uid}/` }).catch(() => [[]] as const);
    const afterPartial = await profileOf();
    row(
      '9. 不正値はHTTP 400',
      partial.status === 400,
      `HTTP ${partial.status}`
    );
    row(
      '10. 不正値では他項目を保存しない',
      afterPartial.name === beforeReject.name && afterPartial.email === beforeReject.email && files.length === 0,
      `name=${afterPartial.name} files=${files.length}`
    );

    const kept = await post({ name: `Renamed${suffix}` });
    const afterOmit = await profileOf();
    row(
      '11. 省略時は既存メールを維持',
      kept.status === 200 && afterOmit.name === `Renamed${suffix}` && afterOmit.email === PLUS,
      `HTTP ${kept.status} email=${afterOmit.email}`
    );

    const client = readFileSync(join(import.meta.dirname, '../../app/components/UserPageSectionsClient.tsx'), 'utf8');
    const discardAt = client.indexOf('const discardDraft');
    const discard = client.slice(discardAt, client.indexOf('const onSectionOrderDraftChange', discardAt));
    row(
      '12. 変更破棄',
      discard.includes('setDraftProfile(profile)') &&
        discard.includes('setFormEpoch') &&
        client.includes('key={`contact-${formEpoch}`}') &&
        client.includes('変更を破棄'),
      '保存済みの値へ戻して入力欄を作り直す'
    );

    const anon: CookieJar = new Map();
    const visitor = await request(`/user/${user.uid}`, anon);
    const owner = await request(`/user/${user.uid}`, jar);
    const poisonPage = await request(`/user/${poisonId}`, anon);
    row(
      '13. 正当なメールを表示',
      visitor.status === 200 && visitor.text.includes(`mailto:${PLUS}?subject=`),
      `HTTP ${visitor.status}`
    );
    row(
      '14. 公開ページに危険なmailtoを出さない',
      poisonPage.status === 200 && !poisonPage.text.includes(`mailto:${poisoned}`) && !poisonPage.text.includes('mailto:?'),
      `HTTP ${poisonPage.status}`
    );
    row(
      '15. 訪問者に入力欄を出さない',
      !visitor.text.includes(`contact-email-${user.uid}`) &&
        !visitor.text.includes('お仕事用メールアドレス') &&
        owner.text.includes(`contact-email-${user.uid}`) &&
        owner.text.includes('※未入力の場合、お仕事依頼ボタンは表示されません。'),
      `visitor=${visitor.status} owner=${owner.status}`
    );

    const failed = rows.filter((item) => item.status === 'fail');
    console.log(`contact-email-check ${rows.length - failed.length}/${rows.length}`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    stopChild(next);
    const cleanup = Promise.all([
      ...createdAuth.map((uid) => admin.auth().deleteUser(uid).catch(() => undefined)),
      ...createdDocs.map((id) => db.collection('users').doc(id).delete().catch(() => undefined)),
    ]);
    await Promise.race([cleanup, new Promise((resolve) => setTimeout(resolve, 3000))]);
    stopChild(emulator);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'contact-email-check failed');
    process.exit(1);
  });
