/**
 * 存在しないプロフィールURLの HTTP 404。
 * demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx scripts/onboarding-emulator/missing-profile-check.ts
 */
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const suffix = Date.now().toString(36);
const photoUrl = 'https://example.com/emu-profile-og.jpg';

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

function listeningPid(port: number): string | null {
  const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    if (!line.includes(`127.0.0.1:${port}`) && !line.includes(`[::]:${port}`)) continue;
    const pid = line.trim().split(/\s+/).pop() ?? '';
    if (/^\d+$/.test(pid) && pid !== '0') return pid;
  }
  return null;
}

function commandLine(pid: string): string {
  try {
    return execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`],
      { encoding: 'utf8' }
    );
  } catch {
    return '';
  }
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
): Promise<{ status: number; text: string; location: string }> {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set('cookie', cookie);
  const res = await fetch(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' });
  remember(res, jar);
  return { status: res.status, text: await res.text(), location: res.headers.get('location') ?? '' };
}

function tag(html: string, name: string): string {
  const match = new RegExp(`<title>([^<]*)</title>`, 'i').exec(html);
  if (name === 'title') return match?.[1] ?? '';
  return '';
}

function meta(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*name="${key}"[^>]*content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]*content="([^"]*)"[^>]*name="${key}"`, 'i'),
    new RegExp(`<meta[^>]*property="${key}"[^>]*content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${key}"`, 'i'),
  ];
  for (const pattern of patterns) {
    const found = pattern.exec(html);
    if (found?.[1]) return found[1];
  }
  return '';
}

function canonical(html: string): string {
  return /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i.exec(html)?.[1] ?? '';
}

function h1(html: string): string {
  return /<h1[^>]*>([^<]*)<\/h1>/i.exec(html)?.[1] ?? '';
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

async function sessionLogin(idToken: string, jar: CookieJar): Promise<{ status: number; text: string; location: string }> {
  return request('/api/session/login', jar, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
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

  const { admin, db } = await import('../../app/lib/firebase');
  const options = admin.app().options;
  if (options.projectId !== 'demo-procom-local') {
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

  const createdAuth: string[] = [];
  const createdDocs: string[] = [];
  let next: ChildProcess | null = null;
  const pubName = `EmuPub${suffix}`;
  const pubTitle = `肩書${suffix}`;
  const legacyName = `EmuLegacy${suffix}`;
  const privateName = `EmuPrivate${suffix}`;
  const requiredName = `EmuRequired${suffix}`;
  const pendingName = `EmuPending${suffix}`;
  const missingUid = `missing${suffix}`;

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

    const pubId = `pub${suffix}`;
    const legacyId = `legacy${suffix}`;
    const privateId = `private${suffix}`;
    const emptyId = `empty${suffix}`;
    const pendingId = `pending${suffix}`;
    const requiredEmail = `required-${suffix}@demo.local`;
    const requiredUser = await admin.auth().createUser({
      email: requiredEmail,
      password: PASSWORD,
      displayName: requiredName,
    });
    createdAuth.push(requiredUser.uid);
    const docs: Array<[string, Record<string, unknown>]> = [
      [
        pubId,
        {
          profile: {
            name: pubName,
            title: pubTitle,
            bio: `bio-${suffix}`,
            isPublic: true,
            onboardingStatus: 'complete',
            photos: [{ url: photoUrl }],
          },
        },
      ],
      [legacyId, { profile: { name: legacyName, title: '既存肩書', photos: [{ url: photoUrl }] } }],
      [
        privateId,
        {
          profile: {
            name: privateName,
            title: '非公開肩書',
            isPublic: false,
            onboardingStatus: 'complete',
            photos: [{ url: photoUrl }],
          },
        },
      ],
      [emptyId, { email: `empty-${suffix}@demo.local` }],
      [pendingId, { deletionPending: true, profile: { name: pendingName, title: '退会中' } }],
      [
        requiredUser.uid,
        {
          profile: {
            name: requiredName,
            title: '未完了肩書',
            onboardingStatus: 'required',
            photos: [{ url: photoUrl }],
          },
        },
      ],
    ];
    for (const [id, body] of docs) {
      await db.collection('users').doc(id).set(body);
      createdDocs.push(id);
    }
    await db.collection('publicProfiles').doc(pubId).set({ seq: 1, name: pubName });

    const anon: CookieJar = new Map();
    const missing = await request(`/user/${missingUid}`, anon);
    const missingTitle = tag(missing.text, 'title');
    const missingRobots = meta(missing.text, 'robots');
    row(
      '1. 存在しないUID',
      missing.status === 404 &&
        missing.text.includes('プロフィールが見つかりません') &&
        !missing.text.includes(pubName) &&
        !missingTitle.includes('｜Procom') &&
        missingRobots.includes('noindex') &&
        !canonical(missing.text).includes(`/user/${missingUid}`) &&
        meta(missing.text, 'og:type') !== 'profile',
      `HTTP ${missing.status} title=${missingTitle} robots=${missingRobots}`
    );

    const pub = await request(`/user/${pubId}`, anon);
    const pubTitleTag = tag(pub.text, 'title');
    row(
      '2. 公開ユーザー',
      pub.status === 200 && pubTitleTag.includes(pubName) && pub.text.includes(pubName) && pub.text.includes(pubTitle),
      `HTTP ${pub.status} title=${pubTitleTag}`
    );
    row(
      '9. 公開プロフィールのSEO',
      pub.status === 200 &&
        pubTitleTag === `${pubName}｜${pubTitle}｜Procom` &&
        meta(pub.text, 'description') === `bio-${suffix}` &&
        meta(pub.text, 'og:image') === photoUrl &&
        meta(pub.text, 'og:title') === `${pubName}｜${pubTitle}｜Procom` &&
        meta(pub.text, 'og:type') === 'profile' &&
        canonical(pub.text) === `https://procom.jp/user/${pubId}` &&
        meta(pub.text, 'robots').includes('index') &&
        !meta(pub.text, 'robots').includes('noindex'),
      `title=${pubTitleTag} robots=${meta(pub.text, 'robots')} canonical=${canonical(pub.text)}`
    );

    const legacy = await request(`/user/${legacyId}`, anon);
    row(
      '3. onboardingStatus未設定',
      legacy.status === 200 &&
        legacy.text.includes(legacyName) &&
        tag(legacy.text, 'title') === `${legacyName}｜既存肩書｜Procom` &&
        !legacy.text.includes('このプロフィールは公開されていません'),
      `HTTP ${legacy.status} title=${tag(legacy.text, 'title')}`
    );

    const hidden = await request(`/user/${privateId}`, anon);
    const hiddenTitle = tag(hidden.text, 'title');
    row(
      '4. isPublic:false',
      hidden.status === 200 &&
        hidden.text.includes(privateName) &&
        hiddenTitle.includes(privateName) &&
        hidden.text.includes('noindex') &&
        hiddenTitle !== 'ページが見つかりません' &&
        !hidden.text.includes('このプロフィールは公開されていません'),
      `HTTP ${hidden.status} title=${hiddenTitle} robots=${meta(hidden.text, 'robots')}`
    );

    const requiredAnon = await request(`/user/${requiredUser.uid}`, anon);
    const ownerJar: CookieJar = new Map();
    const logged = await sessionLogin(await signIn(requiredEmail, PASSWORD), ownerJar);
    const requiredOwner = await request(`/user/${requiredUser.uid}`, ownerJar);
    const requiredH1 = h1(requiredAnon.text);
    row(
      '5. onboardingStatus:required',
      requiredAnon.status === 200 &&
        requiredH1 === 'このプロフィールは公開されていません' &&
        tag(requiredAnon.text, 'title') === 'Procom' &&
        logged.status === 200 &&
        requiredOwner.status >= 300 &&
        requiredOwner.status < 400 &&
        requiredOwner.location.includes('/profile/setup'),
      `anon=${requiredAnon.status} title=${tag(requiredAnon.text, 'title')} h1=${requiredH1} login=${logged.status} owner=${requiredOwner.status}`
    );

    const pending = await request(`/user/${pendingId}`, anon);
    const pendingH1 = h1(pending.text);
    row(
      '6. deletionPending',
      pending.status === 200 &&
        pendingH1 === 'このプロフィールは公開されていません' &&
        tag(pending.text, 'title') === 'Procom',
      `HTTP ${pending.status} title=${tag(pending.text, 'title')} h1=${pendingH1}`
    );

    row(
      '8. 存在しないUIDのmetadata',
      missing.status === 404 &&
        missingTitle === 'ページが見つかりません' &&
        missing.text.includes('noindex') &&
        missing.text.includes('nofollow') &&
        meta(missing.text, 'og:type') !== 'profile' &&
        !missing.text.includes('Procomユーザー') &&
        !canonical(missing.text).includes(`/user/${missingUid}`),
      `title=${missingTitle} nofollow=${missing.text.includes('nofollow')} og=${meta(missing.text, 'og:type')}`
    );

    const empty = await request(`/user/${emptyId}`, anon);
    row(
      '文書はあるがprofileが空',
      empty.status === 200 && tag(empty.text, 'title') === 'Procomユーザー｜Procom',
      `HTTP ${empty.status} title=${tag(empty.text, 'title')}`
    );

    const sitemap = await request('/sitemap.xml', anon);
    const profiles = await request('/sitemaps/profiles/0', anon);
    row(
      '10. sitemap',
      sitemap.status === 200 &&
        sitemap.text.includes('https://procom.jp/users') &&
        !sitemap.text.includes('/user/') &&
        profiles.status === 200 &&
        profiles.text.includes(`/user/${pubId}`) &&
        !profiles.text.includes(`/user/${missingUid}`) &&
        !profiles.text.includes(`/user/${privateId}`) &&
        !profiles.text.includes(`/user/${requiredUser.uid}`),
      `sitemap=${sitemap.status} profiles=${profiles.status}`
    );

    let brokenStatus = 0;
    let brokenNotFound = false;
    let stoppedFirestore = false;
    if (emulator) {
      const pid = listeningPid(8282);
      const line = pid ? commandLine(pid) : '';
      const ownedEmulator = /java|firebase|firestore/i.test(line);
      if (pid && ownedEmulator) {
        spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' });
        stoppedFirestore = true;
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const broken = await request(`/user/${pubId}`, anon, { signal: AbortSignal.timeout(20_000) });
          brokenStatus = broken.status;
          brokenNotFound = broken.status === 404 || tag(broken.text, 'title') === 'ページが見つかりません';
        } catch {
          brokenStatus = 0;
        }
      }
    }
    row(
      '7. Firestoreの取得エラー',
      stoppedFirestore && brokenStatus !== 404 && !brokenNotFound,
      `stopped=${stoppedFirestore} HTTP ${brokenStatus === 0 ? 'no-response' : brokenStatus}`
    );

    const failed = rows.filter((item) => item.status === 'fail');
    console.log(`missing-profile-check ${rows.length - failed.length}/${rows.length}`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    stopChild(next);
    const cleanup = Promise.all([
      ...createdAuth.map((uid) => admin.auth().deleteUser(uid).catch(() => undefined)),
      ...createdDocs.map((id) => db.collection('users').doc(id).delete().catch(() => undefined)),
      db.collection('publicProfiles').doc(`pub${suffix}`).delete().catch(() => undefined),
    ]);
    await Promise.race([cleanup, new Promise((resolve) => setTimeout(resolve, 3000))]);
    stopChild(emulator);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'missing-profile-check failed');
    process.exit(1);
  });
