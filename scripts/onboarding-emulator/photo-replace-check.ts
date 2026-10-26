/**
 * プロフィール画像差し替えの所有者チェック。
 * demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx scripts/onboarding-emulator/photo-replace-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const suffix = Date.now().toString(36);
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);
const PHOTO = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

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

async function sessionLogin(idToken: string, jar: CookieJar): Promise<{ status: number; text: string }> {
  return request('/api/session/login', jar, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

function downloadUrl(bucketName: string, objectPath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=11111111-1111-4111-8111-111111111111`;
}

async function main(): Promise<number> {
  if (process.env.PROCOM_EMULATOR !== '1' || process.env.FIREBASE_PROJECT_ID !== EMULATOR.projectId) {
    console.error('Emulator 隔離が無効です。テストは開始しません。');
    return 1;
  }
  if (process.env.FIREBASE_PROJECT_ID !== 'demo-procom-local') {
    console.error('project id が demo-procom-local ではありません。テストは開始しません。');
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

  const { admin, bucket, db } = await import('../../app/lib/firebase');
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

  async function exists(path: string): Promise<boolean> {
    const [found] = await bucket.file(path).exists();
    return found;
  }

  async function seed(label: string): Promise<{ uid: string; email: string }> {
    const email = `${label}-${suffix}@demo.local`;
    const user = await admin.auth().createUser({ email, password: PASSWORD, displayName: label });
    created.push(user.uid);
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      profile: { name: label, title: 'Public', bio: `bio-${label}` },
    });
    return { uid: user.uid, email };
  }

  async function login(email: string): Promise<CookieJar> {
    const jar: CookieJar = new Map();
    const logged = await sessionLogin(await signIn(email, PASSWORD), jar);
    if (logged.status !== 200) throw new Error(`ログイン失敗 ${logged.status}`);
    return jar;
  }

  async function replacePhotos(uid: string, jar: CookieJar, photos: unknown[]): Promise<{ status: number; text: string }> {
    return request(`/api/user/${uid}`, jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'Kept', photos } }),
    });
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

    const bucketName = bucket.name;
    const owner = await seed('owner');
    const other = await seed('other');
    const ownPath = `photos/${owner.uid}/one.jpg`;
    const otherPath = `photos/${other.uid}/secret.jpg`;
    const bannerPath = `banners/${other.uid}/banner.jpg`;
    await bucket.file(ownPath).save(jpeg, { contentType: 'image/jpeg', resumable: false });
    await bucket.file(otherPath).save(jpeg, { contentType: 'image/jpeg', resumable: false });
    await bucket.file(bannerPath).save(jpeg, { contentType: 'image/jpeg', resumable: false });
    await db.collection('users').doc(owner.uid).update({
      'profile.photos': [{ url: downloadUrl(bucketName, ownPath), position: 50 }],
    });

    const jar = await login(owner.email);
    const replaced = await replacePhotos(owner.uid, jar, [PHOTO]);
    const [ownFiles] = await bucket.getFiles({ prefix: `photos/${owner.uid}/` });
    const ownNames = ownFiles.map((file) => file.name);
    row(
      '1. 自分の画像を差し替え',
      replaced.status === 200 && !ownNames.includes(ownPath) && ownNames.some((name) => name !== ownPath),
      `HTTP ${replaced.status} files=${ownNames.join(',')}`
    );

    await db.collection('users').doc(owner.uid).update({
      'profile.photos': [{ url: downloadUrl(bucketName, otherPath), position: 50 }],
    });
    const foreign = await replacePhotos(owner.uid, jar, [PHOTO]);
    row(
      '2. 他人の画像URLでは削除しない',
      foreign.status === 200 && (await exists(otherPath)),
      `HTTP ${foreign.status} other=${await exists(otherPath)}`
    );

    await db.collection('users').doc(owner.uid).update({
      'profile.photos': [{ url: downloadUrl(bucketName, bannerPath), position: 50 }],
    });
    const banner = await replacePhotos(owner.uid, jar, [PHOTO]);
    row(
      '3. バナーは削除しない',
      banner.status === 200 && (await exists(bannerPath)),
      `HTTP ${banner.status} banner=${await exists(bannerPath)}`
    );

    const encodedOther = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(encodeURIComponent(otherPath))}?alt=media`;
    const encodedEscape = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(`photos/${owner.uid}/../../${bannerPath}`)}?alt=media`;
    await db.collection('users').doc(owner.uid).update({
      'profile.photos': [{ url: encodedOther }, { url: encodedEscape }],
    });
    const encoded = await replacePhotos(owner.uid, jar, [PHOTO]);
    row(
      '4. エンコードされた他人のパスを拒否',
      encoded.status === 200 && (await exists(otherPath)) && (await exists(bannerPath)),
      `HTTP ${encoded.status} other=${await exists(otherPath)} banner=${await exists(bannerPath)}`
    );

    await db.collection('users').doc(owner.uid).update({
      'profile.photos': [
        { url: '%' },
        { url: 'not a url' },
        { url: `http://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(otherPath)}?alt=media` },
        {
          url: `https://evil.example/v0/b/${bucketName}/o/${encodeURIComponent(otherPath)}?alt=media`,
        },
        {
          url: `https://firebasestorage.googleapis.com/v0/b/procom-fea80.firebasestorage.app/o/${encodeURIComponent(otherPath)}?alt=media`,
        },
      ],
    });
    const invalid = await replacePhotos(owner.uid, jar, [PHOTO]);
    row(
      '5. 不正URLはサーバーエラーにしない',
      invalid.status === 200 && (await exists(otherPath)),
      `HTTP ${invalid.status} other=${await exists(otherPath)}`
    );

    const crossed = await replacePhotos(other.uid, jar, [PHOTO]);
    row(
      '6. 他人のUIDへの保存を拒否',
      crossed.status === 403 && (await exists(otherPath)) && (await exists(bannerPath)),
      `HTTP ${crossed.status}`
    );

    const failed = rows.filter((item) => item.status === 'fail');
    console.log(`photo-replace-check ${rows.length - failed.length}/${rows.length}`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    stopChild(next);
    for (const uid of created) {
      await admin.auth().deleteUser(uid).catch(() => undefined);
      await db.collection('users').doc(uid).delete().catch(() => undefined);
      const [files] = await bucket.getFiles({ prefix: `photos/${uid}/` }).catch(() => [[]] as const);
      await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
      await bucket.file(`banners/${uid}/banner.jpg`).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    stopChild(emulator);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'photo-replace-check failed');
    process.exit(1);
  });
