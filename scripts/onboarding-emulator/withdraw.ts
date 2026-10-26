/**
 * 退会の結合テスト。demo-procom-local の Emulator 以外には接続しない。
 * 実行: npm run test:withdraw:integration
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
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

function deletionSeal(
  uid: string,
  phase: 'started' | 'auth_deleted',
  which: 'current' | 'previous'
): { nonce: string; seal: string; sealKeyId: string } {
  const secret = process.env[which === 'current' ? 'ACCOUNT_DELETION_SEAL_SECRET' : 'ACCOUNT_DELETION_SEAL_SECRET_PREVIOUS'];
  const sealKeyId = process.env[which === 'current' ? 'ACCOUNT_DELETION_SEAL_KEY_ID' : 'ACCOUNT_DELETION_SEAL_KEY_ID_PREVIOUS'];
  if (!secret || !sealKeyId) throw new Error('seal secret missing');
  const nonce = randomBytes(32).toString('hex');
  const seal = createHmac('sha256', secret).update(`${uid}:${nonce}:${phase}`).digest('hex');
  return { nonce, seal, sealKeyId };
}

async function missingSealIsFailClosed(): Promise<boolean> {
  const { assertDeletionSealConfigured, classifyDeletionMarker } = await import('../../app/lib/accountDeletionSeal');
  const names = [
    'ACCOUNT_DELETION_SEAL_SECRET',
    'ACCOUNT_DELETION_SEAL_KEY_ID',
    'ACCOUNT_DELETION_SEAL_SECRET_PREVIOUS',
    'ACCOUNT_DELETION_SEAL_KEY_ID_PREVIOUS',
  ] as const;
  const saved = names.map((name) => [name, process.env[name]] as const);
  try {
    for (const name of names) delete process.env[name];
    let threw = false;
    try {
      assertDeletionSealConfigured();
    } catch {
      threw = true;
    }
    const verdict = classifyDeletionMarker('abc', {
      uid: 'abc',
      status: 'in_progress',
      phase: 'auth_deleted',
      nonce: 'n'.repeat(32),
      seal: 's'.repeat(64),
      sealKeyId: 'local-k2',
    });
    return threw && verdict === 'unconfigured';
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
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

function profileOf(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const profile = data?.profile;
  return profile && typeof profile === 'object' ? (profile as Record<string, unknown>) : {};
}

async function main(): Promise<number> {
  if (process.env.PROCOM_EMULATOR !== '1' || process.env.FIREBASE_PROJECT_ID !== EMULATOR.projectId) {
    console.error('Emulator 隔離が無効です。テストは開始しません。');
    return 1;
  }
  if (process.env.FIREBASE_KEY_PATH) {
    console.error('鍵パスが空ではありません。テストは開始しません。');
    return 1;
  }
  row('署名鍵未設定', await missingSealIsFailClosed(), '設定が無いときは削除せず失敗');

  const ports = [9099, 8282, 9199, 4401];
  const already = await Promise.all(ports.map((port) => portOpen(port)));
  let emulator: ChildProcess | null = null;
  if (!already.every(Boolean)) {
    emulator = spawn('npx', [
      'firebase',
      'emulators:start',
      '--only',
      'auth,firestore,storage',
      '--project',
      EMULATOR.projectId,
      '--config',
      'scripts/onboarding-emulator/firebase.json',
    ], {
      cwd: join(import.meta.dirname, '../..'),
      shell: true,
      stdio: 'ignore',
    });
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
  if (options.projectId !== EMULATOR.projectId || options.storageBucket !== EMULATOR.storageBucket) {
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

  async function seed(label: string): Promise<{ uid: string; email: string }> {
    const email = `${label}-${suffix}@demo.local`;
    const user = await admin.auth().createUser({ email, password: PASSWORD, displayName: label });
    created.push(user.uid);
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      profile: { name: label, title: 'Public', bio: `bio-${label}`, isPublic: true },
    });
    await bucket.file(`photos/${user.uid}/one.jpg`).save(Buffer.from('img'), {
      contentType: 'image/jpeg',
      resumable: false,
    });
    await db.collection('publicProfiles').doc(user.uid).set({ uid: user.uid, name: label, title: 'Public' });
    return { uid: user.uid, email };
  }

  async function gone(uid: string): Promise<boolean> {
    const [doc, listed, marker, files] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('publicProfiles').doc(uid).get(),
      db.collection('accountDeletions').doc(uid).get(),
      bucket.getFiles({ prefix: `photos/${uid}/` }),
    ]);
    let authGone = false;
    try {
      await admin.auth().getUser(uid);
    } catch (err: unknown) {
      authGone = (err as { code?: string }).code === 'auth/user-not-found';
    }
    return authGone && !doc.exists && !listed.exists && !marker.exists && files[0].length === 0;
  }

  try {
    if (await portOpen(EMULATOR.nextPort)) {
      row('Next', false, '127.0.0.1:3100 が使用中です');
      return 1;
    }

    const logs: string[] = [];
    const next = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
      cwd: join(import.meta.dirname, '../..'),
      env: process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const keepLog = (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        if (!line || /PRIVATE|AIza|SESSION_PASSWORD|ACCOUNT_DELETION_|BEGIN |Bearer /.test(line)) continue;
        logs.push(line);
        if (logs.length > 30) logs.shift();
      }
    };
    next.stdout?.on('data', keepLog);
    next.stderr?.on('data', keepLog);

    try {
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
        row('Next', false, '隔離した Next が起動しませんでした');
        console.error(logs.join('\n'));
        return 1;
      }

      const legacyEmail = `legacy-${suffix}@demo.local`;
      const legacy = await admin.auth().createUser({ email: legacyEmail, password: PASSWORD, displayName: 'Legacy' });
      created.push(legacy.uid);
      await db.collection('users').doc(legacy.uid).set({
        uid: legacy.uid,
        email: legacyEmail,
        profile: { name: 'LegacyName', title: 'LegacyTitle', bio: 'legacy-bio' },
      });
      await db.collection('publicProfiles').doc(legacy.uid).set({ uid: legacy.uid, name: 'LegacyName', title: 'LegacyTitle' });
      const legacyJar: CookieJar = new Map();
      const legacyLogin = await sessionLogin(await signIn(legacyEmail, PASSWORD), legacyJar);
      const legacySession = await request('/api/session', legacyJar);
      const legacySessionJson = legacySession.status === 200 ? (JSON.parse(legacySession.text) as { loggedIn?: boolean; uid?: string }) : {};
      const legacySave = await request(`/api/user/${legacy.uid}`, legacyJar, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customLinks: [{ label: 'site', url: 'https://example.com' }] }),
      });
      row(
        '18. legacyログイン',
        legacyLogin.status === 200 && legacySessionJson.loggedIn === true && legacySessionJson.uid === legacy.uid && legacySave.status === 200,
        `login=${legacyLogin.status} save=${legacySave.status}`
      );

      const keeper = await seed('keeper');

      async function faulted(label: string, step: string) {
        const user = await seed(label);
        const jar: CookieJar = new Map();
        const login = await sessionLogin(await signIn(user.email, PASSWORD), jar);
        const failed = await request('/api/account/delete-fault', jar, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ step }),
        });
        return { user, jar, login, failed };
      }

      const idle = await faulted('idle', 'unavailable');
      const idleDoc = await db.collection('users').doc(idle.user.uid).get();
      const idleListed = await db.collection('publicProfiles').doc(idle.user.uid).get();
      row(
        'Auth確認不能',
        idle.login.status === 200 && idle.failed.status === 503 && idleDoc.exists && idleDoc.get('deletionPending') !== true && idleListed.exists,
        `HTTP ${idle.failed.status}`
      );

      const authFail = await faulted('authfail', 'deleteAuth');
      const authDoc = await db.collection('users').doc(authFail.user.uid).get();
      const authListed = await db.collection('publicProfiles').doc(authFail.user.uid).get();
      const [authFiles] = await bucket.getFiles({ prefix: `photos/${authFail.user.uid}/` });
      const authStill = await admin.auth().getUser(authFail.user.uid);
      row(
        '14. Auth削除失敗',
        authFail.failed.status === 500 && authStill.uid === authFail.user.uid && authDoc.exists && authDoc.get('deletionPending') === true && !authListed.exists && authFiles.length === 1,
        `HTTP ${authFail.failed.status}`
      );
      async function sweep(fault?: string) {
        return request('/api/internal/account-deletion-resume', new Map(), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.ACCOUNT_DELETION_RESUME_SECRET ?? ''}`,
          },
          body: JSON.stringify(fault ? { fault, uid: keeper.uid } : { uid: keeper.uid }),
        });
      }

      const noBearer = await request('/api/internal/account-deletion-resume', new Map(), { method: 'POST' });
      const badBearer = await request('/api/internal/account-deletion-resume', new Map(), {
        method: 'POST',
        headers: { authorization: 'Bearer not-the-resume-secret' },
      });
      const authBeforeBearer = await admin.auth().getUser(authFail.user.uid);
      row(
        'Bearerなしと不正Bearer',
        noBearer.status === 401 && badBearer.status === 401 && authBeforeBearer.uid === authFail.user.uid,
        `none=${noBearer.status} bad=${badBearer.status}`
      );

      const sweepWhileAuth = await sweep();
      const authAfterSweep = await admin.auth().getUser(authFail.user.uid);
      const authDocAfterSweep = await db.collection('users').doc(authFail.user.uid).get();
      const [authFilesAfter] = await bucket.getFiles({ prefix: `photos/${authFail.user.uid}/` });
      const keeperDuringSweep = await db.collection('users').doc(keeper.uid).get();
      row(
        '後処理はAuth残存を消さない',
        sweepWhileAuth.status === 200 &&
          authAfterSweep.uid === authFail.user.uid &&
          authDocAfterSweep.exists &&
          authFilesAfter.length === 1 &&
          keeperDuringSweep.exists,
        `HTTP ${sweepWhileAuth.status}`
      );
      const authRetry = await request('/api/account/delete', authFail.jar, { method: 'DELETE' });
      row('14. Auth失敗後の再試行', authRetry.status === 200 && (await gone(authFail.user.uid)), `HTTP ${authRetry.status}`);

      const storeFail = await faulted('storefail', 'deleteStorage');
      let storeAuthGone = false;
      try {
        await admin.auth().getUser(storeFail.user.uid);
      } catch (err: unknown) {
        storeAuthGone = (err as { code?: string }).code === 'auth/user-not-found';
      }
      const storeDoc = await db.collection('users').doc(storeFail.user.uid).get();
      const [storeFiles] = await bucket.getFiles({ prefix: `photos/${storeFail.user.uid}/` });
      row(
        '16. Storage削除失敗',
        storeFail.failed.status === 500 && storeAuthGone && storeDoc.exists && storeFiles.length === 1,
        `HTTP ${storeFail.failed.status}`
      );
      const storeRetry = await request('/api/account/delete', storeFail.jar, { method: 'DELETE' });
      row('17. Storage失敗後の再試行', storeRetry.status === 200 && (await gone(storeFail.user.uid)), `HTTP ${storeRetry.status}`);

      const docFail = await faulted('docfail', 'deleteUserDoc');
      let docAuthGone = false;
      try {
        await admin.auth().getUser(docFail.user.uid);
      } catch (err: unknown) {
        docAuthGone = (err as { code?: string }).code === 'auth/user-not-found';
      }
      const failedDoc = await db.collection('users').doc(docFail.user.uid).get();
      const [failedFiles] = await bucket.getFiles({ prefix: `photos/${docFail.user.uid}/` });
      row(
        '15. Firestore削除失敗',
        docFail.failed.status === 500 && docAuthGone && failedDoc.exists && failedFiles.length === 0,
        `HTTP ${docFail.failed.status}`
      );
      const docRetry = await request('/api/account/delete', docFail.jar, { method: 'DELETE' });
      row('17. Firestore失敗後の再試行', docRetry.status === 200 && (await gone(docFail.user.uid)), `HTTP ${docRetry.status}`);

      const storeSweep = await faulted('storesweep', 'deleteStorage');
      const copied = (await db.collection('accountDeletions').doc(storeSweep.user.uid).get()).data() ?? {};
      await db.collection('accountDeletions').doc(keeper.uid).set({ ...copied, uid: keeper.uid });
      const storeHeld = await sweep('deleteStorage');
      const storeHeldDoc = await db.collection('users').doc(storeSweep.user.uid).get();
      const [storeHeldFiles] = await bucket.getFiles({ prefix: `photos/${storeSweep.user.uid}/` });
      const storeHeldJson = storeHeld.status === 200 ? (JSON.parse(storeHeld.text) as { failed?: number }) : {};
      row(
        '後処理の失敗は記録を残す',
        storeHeld.status === 200 && (storeHeldJson.failed ?? 0) >= 1 && storeHeldDoc.exists && storeHeldFiles.length === 1,
        `HTTP ${storeHeld.status} failed=${storeHeldJson.failed ?? 'none'}`
      );
      const storeSweepResult = await sweep();
      const storeSweepJson = storeSweepResult.status === 200 ? (JSON.parse(storeSweepResult.text) as { completed?: number }) : {};
      const keeperAfterCopy = await db.collection('users').doc(keeper.uid).get();
      const [keeperAfterFiles] = await bucket.getFiles({ prefix: `photos/${keeper.uid}/` });
      row(
        'CookieなしでStorage失敗を完了',
        storeSweep.failed.status === 500 &&
          storeSweepResult.status === 200 &&
          (storeSweepJson.completed ?? 0) >= 1 &&
          (await gone(storeSweep.user.uid)) &&
          keeperAfterCopy.exists &&
          keeperAfterFiles.length === 1,
        `HTTP ${storeSweepResult.status}`
      );

      const docSweep = await faulted('docsweep', 'deleteUserDoc');
      const docHeld = await sweep('deleteUserDoc');
      const docHeldDoc = await db.collection('users').doc(docSweep.user.uid).get();
      const docHeldJson = docHeld.status === 200 ? (JSON.parse(docHeld.text) as { failed?: number }) : {};
      row(
        '後処理のFirestore失敗は再実行できる',
        docHeld.status === 200 && (docHeldJson.failed ?? 0) >= 1 && docHeldDoc.exists,
        `HTTP ${docHeld.status}`
      );
      const docSweepResult = await sweep();
      row(
        'CookieなしでFirestore失敗を完了',
        docSweep.failed.status === 500 && docSweepResult.status === 200 && (await gone(docSweep.user.uid)),
        `HTTP ${docSweepResult.status}`
      );

      const crash = await seed('crash');
      await admin.auth().deleteUser(crash.uid);
      const crashSeal = deletionSeal(crash.uid, 'started', 'current');
      await db.collection('accountDeletions').doc(crash.uid).set({
        uid: crash.uid,
        status: 'in_progress',
        phase: 'started',
        nonce: crashSeal.nonce,
        seal: crashSeal.seal,
        sealKeyId: crashSeal.sealKeyId,
      });
      const crashSweep = await sweep();
      row(
        '新しい署名鍵でAuth削除済みを完了',
        crashSweep.status === 200 && (await gone(crash.uid)),
        `HTTP ${crashSweep.status}`
      );

      const oldKey = await seed('oldkey');
      await admin.auth().deleteUser(oldKey.uid);
      const oldSeal = deletionSeal(oldKey.uid, 'auth_deleted', 'previous');
      await db.collection('accountDeletions').doc(oldKey.uid).set({
        uid: oldKey.uid,
        status: 'in_progress',
        phase: 'auth_deleted',
        nonce: oldSeal.nonce,
        seal: oldSeal.seal,
        sealKeyId: oldSeal.sealKeyId,
      });
      const oldSweep = await sweep();
      row('古い署名鍵の退会記録', oldSweep.status === 200 && (await gone(oldKey.uid)), `HTTP ${oldSweep.status}`);

      const sessionKeyed = await seed('sessionkey');
      await admin.auth().deleteUser(sessionKeyed.uid);
      const sessionNonce = randomBytes(32).toString('hex');
      const sessionPassword = process.env.SESSION_PASSWORD;
      if (!sessionPassword) throw new Error('session secret missing');
      const sessionSeal = createHmac('sha256', sessionPassword)
        .update(`${sessionKeyed.uid}:${sessionNonce}:auth_deleted`)
        .digest('hex');
      await db.collection('accountDeletions').doc(sessionKeyed.uid).set({
        uid: sessionKeyed.uid,
        status: 'in_progress',
        phase: 'auth_deleted',
        nonce: sessionNonce,
        seal: sessionSeal,
        sealKeyId: process.env.ACCOUNT_DELETION_SEAL_KEY_ID,
      });
      const sessionSweep = await sweep();
      const sessionDoc = await db.collection('users').doc(sessionKeyed.uid).get();
      const sessionMarker = await db.collection('accountDeletions').doc(sessionKeyed.uid).get();
      row(
        'セッション鍵の署名は削除しない',
        sessionSweep.status === 200 && sessionDoc.exists && sessionMarker.get('status') === 'rejected',
        `HTTP ${sessionSweep.status}`
      );

      const lockedUser = await seed('locked');
      await admin.auth().deleteUser(lockedUser.uid);
      const lockedSeal = deletionSeal(lockedUser.uid, 'auth_deleted', 'current');
      await db.collection('accountDeletions').doc(lockedUser.uid).set({
        uid: lockedUser.uid,
        status: 'in_progress',
        phase: 'auth_deleted',
        nonce: lockedSeal.nonce,
        seal: lockedSeal.seal,
        sealKeyId: lockedSeal.sealKeyId,
      });
      await db.collection('accountDeletionMeta').doc('lock').set({ owner: 'other-run', untilMs: Date.now() + 120_000 });
      const lockedSweep = await sweep();
      const lockedJson = lockedSweep.status === 200 ? (JSON.parse(lockedSweep.text) as { skippedLock?: boolean }) : {};
      const lockedDoc = await db.collection('users').doc(lockedUser.uid).get();
      row(
        '同時実行中は削除しない',
        lockedSweep.status === 200 && lockedJson.skippedLock === true && lockedDoc.exists,
        `HTTP ${lockedSweep.status}`
      );
      await db.collection('accountDeletionMeta').doc('lock').delete();
      const lockedRetry = await sweep();
      row('ロック後の再実行', lockedRetry.status === 200 && (await gone(lockedUser.uid)), `HTTP ${lockedRetry.status}`);

      const concurrent = await seed('concurrent');
      await admin.auth().deleteUser(concurrent.uid);
      const concurrentSeal = deletionSeal(concurrent.uid, 'auth_deleted', 'current');
      await db.collection('accountDeletions').doc(concurrent.uid).set({
        uid: concurrent.uid,
        status: 'in_progress',
        phase: 'auth_deleted',
        nonce: concurrentSeal.nonce,
        seal: concurrentSeal.seal,
        sealKeyId: concurrentSeal.sealKeyId,
      });
      const [firstSweep, secondSweep] = await Promise.all([sweep(), sweep()]);
      const firstJson = firstSweep.status === 200 ? (JSON.parse(firstSweep.text) as { completed?: number }) : {};
      const secondJson = secondSweep.status === 200 ? (JSON.parse(secondSweep.text) as { completed?: number }) : {};
      const completedSum = (firstJson.completed ?? 0) + (secondJson.completed ?? 0);
      row(
        '同時リクエストは一度だけ完了',
        firstSweep.status === 200 && secondSweep.status === 200 && completedSum === 1 && (await gone(concurrent.uid)),
        `completed=${completedSum}`
      );

      await db.collection('accountDeletions').doc(legacy.uid).set({
        uid: legacy.uid,
        status: 'in_progress',
        phase: 'auth_deleted',
        nonce: 'a'.repeat(64),
        seal: 'b'.repeat(64),
      });
      const forged = await sweep();
      const legacyStill = await db.collection('users').doc(legacy.uid).get();
      const forgedMarker = await db.collection('accountDeletions').doc(legacy.uid).get();
      let legacyAuth = false;
      try {
        legacyAuth = (await admin.auth().getUser(legacy.uid)).uid === legacy.uid;
      } catch {
        legacyAuth = false;
      }
      row(
        '偽造した退会記録は削除しない',
        forged.status === 200 && legacyStill.exists && legacyAuth && forgedMarker.get('status') === 'rejected',
        `HTTP ${forged.status}`
      );

      const againSweep = await sweep();
      const againSweepJson = againSweep.status === 200 ? (JSON.parse(againSweep.text) as { completed?: number; failed?: number }) : {};
      row(
        '後処理の再実行',
        againSweep.status === 200 &&
          againSweepJson.completed === 0 &&
          againSweepJson.failed === 0 &&
          (await gone(storeSweep.user.uid)) &&
          (await gone(docSweep.user.uid)) &&
          (await gone(crash.uid)),
        `completed=${againSweepJson.completed ?? 'none'} failed=${againSweepJson.failed ?? 'none'}`
      );

      const email = `rejoin-${suffix}@demo.local`;
      const username = `Rejoin${suffix}`;
      const jar: CookieJar = new Map();
      const registered = await request('/api/register', jar, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, email, password: PASSWORD }),
      });
      const registeredJson = registered.status === 200 ? (JSON.parse(registered.text) as { redirectTo?: string }) : {};
      const first = await admin.auth().getUserByEmail(email);
      created.push(first.uid);
      const firstDoc = await db.collection('users').doc(first.uid).get();
      const firstProfile = profileOf(firstDoc.data());
      row(
        '1. 新規登録',
        registered.status === 200 && firstDoc.exists && firstProfile.onboardingStatus === 'required' && registeredJson.redirectTo === '/profile/setup',
        `HTTP ${registered.status}`
      );
      row('2. 通常ログイン', (await request('/api/session', jar)).text.includes('"loggedIn":true'), '登録時のセッション');

      const drafted = await request('/api/profile/setup', jar, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: username, title: 'KeptTitle' }),
      });
      const uploaded = await request('/api/profile/setup/photo', jar, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: PHOTO }),
      });
      const uploadedJson = uploaded.status === 200 ? (JSON.parse(uploaded.text) as { url?: string }) : {};
      const photoUrl = uploadedJson.url ?? '';
      const saved = await request('/api/profile/setup', jar, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: username, title: 'KeptTitle', photoUrl }),
      });
      await db.collection('users').doc(first.uid).update({
        'profile.bio': 'old-secret-bio',
        'profile.onboardingStatus': 'complete',
        'profile.isPublic': true,
      });
      await db.collection('publicProfiles').doc(first.uid).set({ uid: first.uid, name: username, title: 'KeptTitle' });
      const listedBefore = await db.collection('publicProfiles').doc(first.uid).get();
      const [filesBefore] = await bucket.getFiles({ prefix: `photos/${first.uid}/` });
      row(
        '3. プロフィールと画像',
        drafted.status === 200 && uploaded.status === 200 && saved.status === 200 && listedBefore.exists && filesBefore.length > 0,
        `draft=${drafted.status} photo=${uploaded.status}`
      );

      const stale = new Map(jar);
      const removed = await request('/api/account/delete', jar, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: keeper.uid }),
      });
      const keeperDoc = await db.collection('users').doc(keeper.uid).get();
      const [keeperFiles] = await bucket.getFiles({ prefix: `photos/${keeper.uid}/` });
      let oldLoginFailed = false;
      try {
        await signIn(email, PASSWORD);
      } catch {
        oldLoginFailed = true;
      }
      const after = await gone(first.uid);
      row('4. 退会', removed.status === 200 && removed.text.includes('"success":true'), `HTTP ${removed.status}`);
      row('5-8. Auth・Firestore・Storage・掲載', after, '本人のAuth、文書、画像、publicProfiles を削除');
      row('10. 古いパスワード', oldLoginFailed, '再登録前にログイン失敗');
      row('13. 別ユーザー', keeperDoc.exists && keeperFiles.length === 1 && (await admin.auth().getUser(keeper.uid)).uid === keeper.uid, '削除対象外を維持');

      const staleSession = await request('/api/session', stale);
      const staleEdit = await request(`/api/user/${first.uid}`, stale, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customLinks: [{ label: 'x', url: 'https://example.com' }] }),
      });
      const staleUpload = await request('/api/uploadPhotos', stale, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ base64Images: [PHOTO] }),
      });
      const staleDelete = await request('/api/account/delete', stale, { method: 'DELETE' });
      const staleAdmin = await request('/api/admin/users', stale);
      row(
        '9. 古いCookie',
        !staleSession.text.includes('"loggedIn":true') &&
          staleEdit.status === 403 &&
          staleUpload.status === 401 &&
          staleDelete.status === 401 &&
          staleAdmin.status === 403,
        `session=${staleSession.status} edit=${staleEdit.status} upload=${staleUpload.status} delete=${staleDelete.status}`
      );

      const again = await request('/api/register', new Map(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: `Next${suffix}`, email, password: PASSWORD }),
      });
      const againJson = again.status === 200 ? (JSON.parse(again.text) as { redirectTo?: string }) : {};
      const second = again.status === 200 ? await admin.auth().getUserByEmail(email) : null;
      if (second) created.push(second.uid);
      const secondDoc = second ? await db.collection('users').doc(second.uid).get() : null;
      const secondProfile = profileOf(secondDoc?.data());
      const staleOnNew = second
        ? await request(`/api/user/${second.uid}`, stale, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ customLinks: [{ label: 'x', url: 'https://example.com' }] }),
          })
        : { status: 0 };
      row(
        '11-12. 再登録',
        again.status === 200 &&
          !!second &&
          second.uid !== first.uid &&
          againJson.redirectTo === '/profile/setup' &&
          secondProfile.onboardingStatus === 'required' &&
          secondProfile.bio !== 'old-secret-bio' &&
          secondProfile.title !== 'KeptTitle' &&
          staleOnNew.status === 403,
        `HTTP ${again.status} uid-changed=${second ? second.uid !== first.uid : false}`
      );

      const sweepNew = await request('/api/internal/account-deletion-resume', new Map(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.ACCOUNT_DELETION_RESUME_SECRET ?? ''}`,
        },
        body: JSON.stringify({ uid: second?.uid ?? keeper.uid }),
      });
      let secondAuth = false;
      if (second) {
        try {
          secondAuth = (await admin.auth().getUser(second.uid)).uid === second.uid;
        } catch {
          secondAuth = false;
        }
      }
      const secondStill = second ? await db.collection('users').doc(second.uid).get() : null;
      row(
        '再登録UIDは後処理の対象外',
        sweepNew.status === 200 && secondAuth && !!secondStill?.exists && second?.uid !== first.uid,
        `HTTP ${sweepNew.status}`
      );

      const legacyAfter = await request('/api/session', legacyJar);
      const legacyDoc = await db.collection('users').doc(legacy.uid).get();
      const legacyListed = await db.collection('publicProfiles').doc(legacy.uid).get();
      row(
        '18. legacy維持',
        legacyAfter.text.includes('"loggedIn":true') && legacyDoc.exists && profileOf(legacyDoc.data()).bio === 'legacy-bio' && legacyListed.exists,
        '退会していないユーザーのログインと掲載を維持'
      );
    } finally {
      stopChild(next);
    }
  } finally {
    if (admin.app().options.projectId === EMULATOR.projectId) {
      for (const uid of created) {
        await admin.auth().deleteUser(uid).catch(() => undefined);
        await db.collection('users').doc(uid).delete().catch(() => undefined);
        await db.collection('publicProfiles').doc(uid).delete().catch(() => undefined);
        await db.collection('accountDeletions').doc(uid).delete().catch(() => undefined);
        const [files] = await bucket.getFiles({ prefix: `photos/${uid}/` }).catch(() => [[]] as const);
        await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
      }
      await db.collection('accountDeletionMeta').doc('lock').delete().catch(() => undefined);
    }
    if (emulator && emulator.exitCode == null) stopChild(emulator);
  }

  const failed = rows.filter((item) => item.status === 'fail');
  console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'error';
    console.error(message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/AIza|PRIVATE|BEGIN /g, '[redacted]'));
    process.exit(1);
  });
