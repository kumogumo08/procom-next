/**
 * Firebase Auth の一時障害をユーザー不存在と分けていること。
 * demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx scripts/onboarding-emulator/auth-outage-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const suffix = Date.now().toString(36);
const faultFile = join(tmpdir(), `procom-auth-fault-${suffix}.txt`);

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

function setFault(mode: 'off' | 'unavailable' | 'network' | 'timeout' | 'unknown'): void {
  writeFileSync(faultFile, mode, 'utf8');
}

type CookieJar = Map<string, string>;

function remember(lines: string[], jar: CookieJar): void {
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

function clearsSession(lines: string[]): boolean {
  return lines.some((line) => {
    const first = line.split(';')[0] ?? '';
    if (!first.startsWith('procom_session=')) return false;
    const value = first.slice('procom_session='.length);
    return value.length === 0 || /max-age=0/i.test(line);
  });
}

async function request(
  path: string,
  jar: CookieJar,
  init: RequestInit = {}
): Promise<{ status: number; text: string; json: Record<string, unknown>; setCookie: string[] }> {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set('cookie', cookie);
  const res = await fetch(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' });
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  remember(setCookie, jar);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, text, json, setCookie };
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

  setFault('off');
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

  const createdDocs: string[] = [];
  const authUsers: string[] = [];
  let next: ChildProcess | null = null;

  async function login(email: string): Promise<CookieJar> {
    const jar: CookieJar = new Map();
    const logged = await request('/api/session/login', jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: await signIn(email, PASSWORD) }),
    });
    if (logged.status !== 200 || !jar.get('procom_session')) {
      throw new Error(`ログイン失敗 ${logged.status}`);
    }
    return jar;
  }

  function kept(jar: CookieJar, lines: string[], body: string): boolean {
    const value = jar.get('procom_session') ?? '';
    return value.length > 10 && !clearsSession(lines) && !body.includes(value) && !body.includes('private_key');
  }

  try {
    if (await portOpen(EMULATOR.nextPort)) {
      console.error('127.0.0.1:3100 が使用中です。テストは開始しません。');
      return 1;
    }

    next = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
      cwd: join(import.meta.dirname, '../..'),
      env: { ...process.env, PROCOM_AUTH_FAULT_FILE: faultFile },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    next.stdout?.on('data', () => undefined);
    next.stderr?.on('data', () => undefined);

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

    const email = `outage-${suffix}@demo.local`;
    const user = await admin.auth().createUser({ email, password: PASSWORD, displayName: 'Alive' });
    authUsers.push(user.uid);
    createdDocs.push(user.uid);
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      profile: { name: 'Before', title: '肩書', isPublic: true, onboardingStatus: 'complete' },
    });

    const goneEmail = `gone-${suffix}@demo.local`;
    const gone = await admin.auth().createUser({ email: goneEmail, password: PASSWORD, displayName: 'Gone' });
    createdDocs.push(gone.uid);
    await db.collection('users').doc(gone.uid).set({
      uid: gone.uid,
      email: goneEmail,
      profile: { name: 'GoneName', title: '肩書', isPublic: true, onboardingStatus: 'complete' },
    });

    const midEmail = `mid-${suffix}@demo.local`;
    const mid = await admin.auth().createUser({ email: midEmail, password: PASSWORD, displayName: 'Mid' });
    authUsers.push(mid.uid);
    createdDocs.push(mid.uid);
    await db.collection('users').doc(mid.uid).set({
      uid: mid.uid,
      email: midEmail,
      deletionPending: true,
      profile: { name: 'MidName', title: '肩書', isPublic: true, onboardingStatus: 'complete' },
    });

    const jar = await login(email);
    const session = await request('/api/session', jar);
    const saved = await request(`/api/user/${user.uid}`, jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'Alive' } }),
    });
    const afterSave = await db.collection('users').doc(user.uid).get();
    row(
      '1. 正常ユーザーは認証できる',
      session.status === 200 &&
        session.json.loggedIn === true &&
        session.json.uid === user.uid &&
        saved.status === 200 &&
        afterSave.get('profile')?.name === 'Alive',
      `session=${session.status} save=${saved.status}`
    );

    const goneJar = await login(goneEmail);
    await admin.auth().deleteUser(gone.uid);
    const goneSession = await request('/api/session', goneJar);
    const gonePost = await request(`/api/user/${gone.uid}`, goneJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'Revived' } }),
    });
    const goneDoc = await db.collection('users').doc(gone.uid).get();
    row(
      '2. user-not-found は認証失敗',
      goneSession.status === 200 && goneSession.json.loggedIn === false,
      `session=${goneSession.status} loggedIn=${String(goneSession.json.loggedIn)}`
    );
    row(
      '10. 削除済みユーザーは保護操作を拒否',
      gonePost.status === 403 && goneDoc.get('profile')?.name === 'GoneName' && kept(goneJar, gonePost.setCookie, gonePost.text),
      `HTTP ${gonePost.status}`
    );

    const offEmail = `off-${suffix}@demo.local`;
    const off = await admin.auth().createUser({ email: offEmail, password: PASSWORD, displayName: 'Off' });
    authUsers.push(off.uid);
    createdDocs.push(off.uid);
    await db.collection('users').doc(off.uid).set({
      uid: off.uid,
      email: offEmail,
      profile: { name: 'OffName', title: '肩書', isPublic: true, onboardingStatus: 'complete' },
    });
    const offJar = await login(offEmail);
    await admin.auth().updateUser(off.uid, { disabled: true });
    let getUserThrew = false;
    let disabledFlag = false;
    try {
      const record = await admin.auth().getUser(off.uid);
      disabledFlag = record.disabled === true;
    } catch {
      getUserThrew = true;
    }
    row(
      'getUserは無効化ユーザーをdisabled trueで返す',
      !getUserThrew && disabledFlag,
      getUserThrew ? 'threw' : `disabled=${String(disabledFlag)}`
    );
    const offSession = await request('/api/session', offJar);
    const offPost = await request(`/api/user/${off.uid}`, offJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'OffHijack' } }),
    });
    const offOshi = await request(`/api/oshi/${user.uid}`, offJar, { method: 'POST' });
    const offDelete = await request('/api/account/delete', offJar, { method: 'DELETE' });
    const offDoc = await db.collection('users').doc(off.uid).get();
    const offMarker = await db.collection('accountDeletions').doc(off.uid).get();
    const offAuth = await admin.auth().getUser(off.uid);
    const oshiAfterOff = await db.collection('users').doc(user.uid).get();
    row(
      '無効化ユーザーは認証しない',
      offSession.status === 403 && offSession.json.loggedIn !== true,
      `session=${offSession.status}`
    );
    row(
      '無効化ユーザーは保護操作を拒否',
      offPost.status === 403 &&
        offOshi.status === 403 &&
        offDelete.status === 403 &&
        offDoc.get('profile')?.name === 'OffName' &&
        offDoc.get('deletionPending') !== true &&
        !offMarker.exists &&
        offAuth.disabled === true &&
        oshiAfterOff.get('oshiCount') == null &&
        !offOshi.setCookie.some((line) => line.startsWith('procom_visitor=')) &&
        kept(offJar, offPost.setCookie, offPost.text) &&
        kept(offJar, offDelete.setCookie, offDelete.text),
      `post=${offPost.status} oshi=${offOshi.status} delete=${offDelete.status}`
    );
    await admin.auth().updateUser(off.uid, { disabled: false });
    const offAgain = await request('/api/session', offJar);
    const offSaved = await request(`/api/user/${off.uid}`, offJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'OffRestored' } }),
    });
    const offRestored = await db.collection('users').doc(off.uid).get();
    row(
      '無効化解除後は同じセッションで利用できる',
      offAgain.status === 200 &&
        offAgain.json.loggedIn === true &&
        offAgain.json.uid === off.uid &&
        offSaved.status === 200 &&
        offRestored.get('profile')?.name === 'OffRestored',
      `session=${offAgain.status} save=${offSaved.status}`
    );

    const midJar = await login(midEmail);
    const midSession = await request('/api/session', midJar);
    row(
      '13. 退会途中でも Auth に残るユーザーは不存在にしない',
      midSession.status === 200 && midSession.json.loggedIn === true && midSession.json.uid === mid.uid,
      `session=${midSession.status}`
    );

    async function profileName(): Promise<string> {
      const snap = await db.collection('users').doc(user.uid).get();
      const name = snap.get('profile')?.name;
      return typeof name === 'string' ? name : '';
    }

    async function expectOutage(label: string, mode: 'unavailable' | 'network' | 'timeout' | 'unknown'): Promise<void> {
      setFault(mode);
      const probe = await request('/api/session', jar);
      const post = await request(`/api/user/${user.uid}`, jar, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: { name: 'Hijack' } }),
      });
      const name = await profileName();
      const authStill = await admin.auth().getUser(user.uid).then(() => true).catch(() => false);
      row(
        label,
        probe.status === 503 &&
          probe.json.loggedIn !== true &&
          post.status === 503 &&
          name === 'Alive' &&
          authStill &&
          kept(jar, probe.setCookie, probe.text) &&
          kept(jar, post.setCookie, post.text),
        `session=${probe.status} post=${post.status} name=${name}`
      );
    }

    await expectOutage('3-6. サービス障害は503でCookieを残す', 'unavailable');

    const setupRes = await fetch(`${ORIGIN}/profile/setup`, {
      headers: { cookie: cookieHeader(jar) },
      redirect: 'manual',
    });
    const setupLocation = setupRes.headers.get('location') ?? '';
    const setupText = await setupRes.text();
    row(
      '一時障害で初期設定をログインへ戻さない',
      setupRes.status === 200 &&
        !setupLocation.includes('/login') &&
        setupText.includes('認証サービスが一時的に利用できません'),
      `HTTP ${setupRes.status}`
    );

    setFault('unavailable');
    const removed = await request('/api/account/delete', jar, { method: 'DELETE' });
    const pendingDoc = await db.collection('users').doc(user.uid).get();
    const marker = await db.collection('accountDeletions').doc(user.uid).get();
    const authAfterDelete = await admin.auth().getUser(user.uid).then(() => true).catch(() => false);
    row(
      '11. 一時障害では退会も更新も完了しない',
      removed.status === 503 &&
        pendingDoc.get('deletionPending') !== true &&
        pendingDoc.get('profile')?.name === 'Alive' &&
        !marker.exists &&
        authAfterDelete &&
        kept(jar, removed.setCookie, removed.text),
      `HTTP ${removed.status}`
    );

    const anon = await request(`/api/user/${user.uid}`, new Map(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'Hijack' } }),
    });
    row('未ログインは503にしない', anon.status === 403, `HTTP ${anon.status}`);

    const oshi = await request(`/api/oshi/${user.uid}`, jar, { method: 'POST' });
    const oshiDoc = await db.collection('users').doc(user.uid).get();
    row(
      '一時障害の推しは記録しない',
      oshi.status === 503 &&
        oshiDoc.get('oshiCount') == null &&
        !oshi.setCookie.some((line) => line.startsWith('procom_visitor=')) &&
        kept(jar, oshi.setCookie, oshi.text),
      `HTTP ${oshi.status}`
    );

    await expectOutage('7. ネットワーク障害', 'network');
    await expectOutage('8. タイムアウト', 'timeout');
    await expectOutage('9. 不明なgetUserエラー', 'unknown');

    const regEmail = `reg-${suffix}@demo.local`;
    const reg = await request('/api/register', new Map(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: `Reg${suffix}`, email: regEmail, password: PASSWORD }),
    });
    let regCreated = true;
    try {
      const created = await admin.auth().getUserByEmail(regEmail);
      authUsers.push(created.uid);
    } catch {
      regCreated = false;
    }
    row('登録中の一時障害はユーザーを作らない', reg.status === 503 && !regCreated, `HTTP ${reg.status}`);

    const midPost = await request(`/api/user/${mid.uid}`, midJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'MidHijack' } }),
    });
    const midDoc = await db.collection('users').doc(mid.uid).get();
    row(
      '13. 退会途中の安全対策は維持',
      midPost.status === 503 && midDoc.get('deletionPending') === true && midDoc.get('profile')?.name === 'MidName',
      `HTTP ${midPost.status}`
    );

    setFault('off');
    const again = await request('/api/session', jar);
    const recovered = await request(`/api/user/${user.uid}`, jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'Recovered' } }),
    });
    const recoveredDoc = await db.collection('users').doc(user.uid).get();
    row(
      '12. 復旧後は同じセッションで利用できる',
      again.status === 200 &&
        again.json.loggedIn === true &&
        again.json.uid === user.uid &&
        recovered.status === 200 &&
        recoveredDoc.get('profile')?.name === 'Recovered' &&
        kept(jar, again.setCookie, again.text),
      `session=${again.status} save=${recovered.status}`
    );

    const failed = rows.filter((item) => item.status === 'fail');
    console.log(`${rows.length - failed.length}/${rows.length} passed`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    stopChild(next);
    for (const uid of createdDocs) {
      await db.collection('users').doc(uid).delete().catch(() => undefined);
      await db.collection('accountDeletions').doc(uid).delete().catch(() => undefined);
    }
    for (const uid of authUsers) {
      await admin.auth().deleteUser(uid).catch(() => undefined);
    }
    try {
      unlinkSync(faultFile);
    } catch {
      // ファイルが無くても終了する
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
