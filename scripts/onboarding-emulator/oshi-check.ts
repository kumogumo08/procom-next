/**
 * 推し登録が空のユーザードキュメントを作らないこと。
 * demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx scripts/onboarding-emulator/oshi-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const suffix = Date.now().toString(36);

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
): Promise<{ status: number; text: string; json: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set('cookie', cookie);
  const res = await fetch(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' });
  remember(res, jar);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, text, json };
}

function postOshi(uid: string, jar: CookieJar) {
  return request(`/api/oshi/${encodeURIComponent(uid)}`, jar, { method: 'POST' });
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

  const ports = [9099, 8282, 9199, 4401];
  const already = await Promise.all(ports.map((port) => portOpen(port)));
  let emulator: ChildProcess | null = null;
  if (!already.every(Boolean)) {
    emulator = spawn(
      'npx',
      [
        'firebase',
        'emulators:start',
        '--only',
        'auth,firestore,storage',
        '--project',
        EMULATOR.projectId,
        '--config',
        'scripts/onboarding-emulator/firebase.json',
      ],
      {
        cwd: join(import.meta.dirname, '../..'),
        shell: true,
        stdio: 'ignore',
      }
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

  const { admin, db } = await import('../../app/lib/firebase');
  const options = admin.app().options;
  if (options.projectId !== 'demo-procom-local' || options.storageBucket !== EMULATOR.storageBucket) {
    console.error('Admin SDK の接続先が demo-procom-local ではありません。中止しました。');
    stopChild(emulator);
    return 1;
  }
  const marked = (globalThis as { __procomEmulatorCredential?: boolean }).__procomEmulatorCredential === true;
  if (!marked) {
    console.error('Emulator 用の資格情報が使われていません。中止しました。');
    stopChild(emulator);
    return 1;
  }

  const created: string[] = [];
  let next: ChildProcess | null = null;
  const authUsers: string[] = [];

  async function putUser(id: string, data: Record<string, unknown>): Promise<void> {
    created.push(id);
    await db.collection('users').doc(id).set(data);
  }

  try {
    if (await portOpen(EMULATOR.nextPort)) {
      console.error('127.0.0.1:3100 が使用中です。テストは開始しません。');
      return 1;
    }

    const logs: string[] = [];
    next = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
      cwd: join(import.meta.dirname, '../..'),
      env: process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const keepLog = (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        if (!line || /PRIVATE|AIza|SESSION_PASSWORD|BEGIN |Bearer /.test(line)) continue;
        logs.push(line);
        if (logs.length > 40) logs.shift();
      }
    };
    next.stdout?.on('data', keepLog);
    next.stderr?.on('data', keepLog);

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
      console.error(logs.join('\n'));
      console.error('隔離した Next が起動しませんでした。');
      return 1;
    }

    const publicId = `pub${suffix}`;
    const legacyId = `leg${suffix}`;
    const pendingId = `pen${suffix}`;
    const requiredId = `req${suffix}`;
    const privateId = `pri${suffix}`;
    const withdrawnId = `gon${suffix}`;
    const missingId = `mis${suffix}`;
    const concurrentId = `con${suffix}`;
    const sessionTargetId = `ses${suffix}`;
    await putUser(publicId, {
      uid: publicId,
      profile: { name: 'Public', title: 'Title', isPublic: true, onboardingStatus: 'complete' },
    });
    await putUser(legacyId, {
      uid: legacyId,
      profile: { name: 'Legacy', title: 'Title', isPublic: true },
    });
    await putUser(pendingId, {
      uid: pendingId,
      deletionPending: true,
      oshiCount: 3,
      profile: { name: 'Leaving', title: 'Title', isPublic: true, onboardingStatus: 'complete' },
    });
    await putUser(requiredId, {
      uid: requiredId,
      profile: { name: 'Required', title: 'Title', isPublic: true, onboardingStatus: 'required' },
    });
    await putUser(privateId, {
      uid: privateId,
      profile: { name: 'Private', title: 'Title', isPublic: false, onboardingStatus: 'complete' },
    });
    await putUser(withdrawnId, {
      uid: withdrawnId,
      profile: { name: 'Gone', title: 'Title', isPublic: true, onboardingStatus: 'complete' },
    });
    await db.collection('users').doc(withdrawnId).delete();
    await putUser(concurrentId, {
      uid: concurrentId,
      profile: { name: 'Concurrent', title: 'Title', isPublic: true, onboardingStatus: 'complete' },
    });
    await putUser(sessionTargetId, {
      uid: sessionTargetId,
      profile: { name: 'Session', title: 'Title', isPublic: true, onboardingStatus: 'complete' },
    });

    const jar: CookieJar = new Map();
    const first = await postOshi(publicId, jar);
    const publicAfter = await db.collection('users').doc(publicId).get();
    const publicProfile = (publicAfter.get('profile') ?? {}) as { name?: unknown };
    row(
      '公開プロフィールへの推し',
      first.status === 200 &&
        first.json.success === true &&
        first.json.todayCount === 1 &&
        first.json.totalCount === 1 &&
        publicAfter.get('oshiCount') === 1 &&
        publicProfile.name === 'Public',
      `HTTP ${first.status}`
    );

    const listed = await request(`/api/oshi/${publicId}`, jar);
    row(
      '推しボタンの取得レスポンス',
      listed.status === 200 &&
        listed.json.oshiCount === 1 &&
        listed.json.todayCount === 1 &&
        listed.json.totalCount === 1,
      `HTTP ${listed.status}`
    );

    const missing = await postOshi(missingId, jar);
    const missingDoc = await db.collection('users').doc(missingId).get();
    row(
      '存在しないUID',
      missing.status === 404 && missing.json.success === false && missing.json.error === 'not_found' && !missingDoc.exists,
      `HTTP ${missing.status}`
    );

    const withdrawn = await postOshi(withdrawnId, jar);
    const withdrawnDoc = await db.collection('users').doc(withdrawnId).get();
    row(
      '退会済みUID',
      withdrawn.status === 404 && withdrawn.json.error === 'not_found' && !withdrawnDoc.exists,
      `HTTP ${withdrawn.status}`
    );

    const pending = await postOshi(pendingId, jar);
    const pendingDoc = await db.collection('users').doc(pendingId).get();
    row(
      '退会途中',
      pending.status === 404 &&
        pending.json.error === 'not_found' &&
        !pending.text.includes('deletionPending') &&
        pendingDoc.get('deletionPending') === true &&
        pendingDoc.get('oshiCount') === 3,
      `HTTP ${pending.status}`
    );

    const required = await postOshi(requiredId, jar);
    const requiredDoc = await db.collection('users').doc(requiredId).get();
    row(
      '初期設定未完了',
      required.status === 404 && required.json.error === 'not_found' && requiredDoc.get('oshiCount') == null,
      `HTTP ${required.status}`
    );

    const hidden = await postOshi(privateId, jar);
    const privateDoc = await db.collection('users').doc(privateId).get();
    row(
      '非公開プロフィール',
      hidden.status === 404 && hidden.json.error === 'not_found' && privateDoc.get('oshiCount') == null,
      `HTTP ${hidden.status}`
    );

    const legacyJar: CookieJar = new Map();
    const legacy = await postOshi(legacyId, legacyJar);
    const legacyDoc = await db.collection('users').doc(legacyId).get();
    const legacyProfile = (legacyDoc.get('profile') ?? {}) as Record<string, unknown>;
    row(
      'legacy公開ユーザー',
      legacy.status === 200 &&
        legacy.json.success === true &&
        legacy.json.totalCount === 1 &&
        legacyDoc.get('oshiCount') === 1 &&
        !Object.prototype.hasOwnProperty.call(legacyProfile, 'onboardingStatus'),
      `HTTP ${legacy.status}`
    );

    const burst = await Promise.all(Array.from({ length: 8 }, () => postOshi(concurrentId, new Map())));
    const concurrentDoc = await db.collection('users').doc(concurrentId).get();
    row(
      '同時投票の加算',
      burst.every((res) => res.status === 200 && res.json.success === true) && concurrentDoc.get('oshiCount') === 8,
      `count=${String(concurrentDoc.get('oshiCount'))}`
    );

    const still = await request(`/api/oshi/${publicId}`, jar);
    row(
      '拒否では1日の枠を消費しない',
      still.status === 200 && still.json.todayCount === 1,
      `today=${String(still.json.todayCount)}`
    );
    const second = await postOshi(publicId, jar);
    row(
      '拒否後も残りの枠で推せる',
      second.status === 200 && second.json.success === true && second.json.todayCount === 2 && second.json.totalCount === 2,
      `HTTP ${second.status}`
    );

    let limit = second;
    for (let count = 3; count <= 5; count += 1) {
      limit = await postOshi(publicId, jar);
      if (limit.status !== 200 || limit.json.todayCount !== count) break;
    }
    const blocked = await postOshi(publicId, jar);
    const afterLimit = await db.collection('users').doc(publicId).get();
    row(
      '1日5回の上限',
      limit.status === 200 &&
        limit.json.todayCount === 5 &&
        blocked.status === 429 &&
        blocked.json.success === false &&
        blocked.json.reason === 'daily_limit' &&
        blocked.json.todayCount === 5 &&
        afterLimit.get('oshiCount') === 5,
      `HTTP ${blocked.status}`
    );

    const invalid = await request('/api/oshi/bad-uid', jar, { method: 'POST' });
    const invalidDoc = await db.collection('users').doc('bad-uid').get();
    const afterInvalid = await request(`/api/oshi/${publicId}`, jar);
    row(
      '不正なUID',
      invalid.status === 400 && invalid.json.error === 'Missing UID' && !invalidDoc.exists && afterInvalid.json.todayCount === 5,
      `HTTP ${invalid.status}`
    );

    const email = `oshi-${suffix}@demo.local`;
    const actor = await admin.auth().createUser({ email, password: PASSWORD, displayName: 'Actor' });
    authUsers.push(actor.uid);
    const sessionJar: CookieJar = new Map();
    const idToken = await signIn(email, PASSWORD);
    const logged = await request('/api/session/login', sessionJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const sessionOshi = await postOshi(sessionTargetId, sessionJar);
    const sessionDoc = await db.collection('users').doc(sessionTargetId).get();
    row(
      '未ログインとログイン中の通常応答',
      logged.status === 200 &&
        sessionOshi.status === 200 &&
        sessionOshi.json.success === true &&
        sessionOshi.json.todayCount === 1 &&
        sessionOshi.json.totalCount === 1 &&
        sessionDoc.get('oshiCount') === 1,
      `login=${logged.status} oshi=${sessionOshi.status}`
    );

    const failed = rows.filter((item) => item.status === 'fail');
    console.log(`${rows.length - failed.length}/${rows.length} passed`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    stopChild(next);
    for (const uid of created) {
      await db.collection('users').doc(uid).delete().catch(() => undefined);
    }
    for (const uid of authUsers) {
      await admin.auth().deleteUser(uid).catch(() => undefined);
    }
    stopChild(emulator);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.name : 'error');
    process.exit(1);
  });
