/**
 * 初期設定の結合テスト。Emulator が3つ揃っているときだけ Next を起動する。
 * 本番の鍵、SESSION_PASSWORD、プロジェクトは使わない。
 *
 * 実行: npm run test:onboarding:integration
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMULATOR, applyIsolatedEnv } from './isolate';

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const suffix = Date.now().toString(36);
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);
const PHOTO = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

type Status = 'pass' | 'fail' | 'not-run';
type Row = { item: string; status: Status; note: string };
const rows: Row[] = [];

function row(item: string, status: Status, note: string): void {
  rows.push({ item, status, note });
  console.log(`${status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : 'SKIP'} ${item}: ${note}`);
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

function refuseKeyRead(): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'procom-emu-'));
  const sentinel = join(dir, 'not-a-key.txt');
  writeFileSync(sentinel, 'DO-NOT-READ\n', 'utf8');
  const modes = ['missing', 'project', 'bucket'];
  for (const mode of modes) {
    const result = spawnSync('npx', ['tsx', 'scripts/onboarding-emulator/refuse.ts', mode, sentinel], {
      cwd: join(import.meta.dirname, '../..'),
      shell: true,
      encoding: 'utf8',
    });
    const output = `${result.stdout ?? ''}`;
    if (!output.includes('REFUSED') || output.includes('STARTED') || output.includes('KEY')) {
      row('接続防止', 'fail', `${mode} の起動拒否を確認できませんでした`);
      return false;
    }
  }
  row('接続防止', 'pass', 'Emulator設定が不足すると鍵を読まず停止する');
  return true;
}

async function emulatorReady(): Promise<boolean> {
  const ports = [9099, 8282, 9199, 4401];
  const open = await Promise.all(ports.map((port) => portOpen(port)));
  if (open.some((ready) => !ready)) {
    row('Emulator起動', 'fail', 'Auth 9099、Firestore 8282、Storage 9199 のいずれかが停止しています');
    return false;
  }
  const hub = await fetch(`http://${EMULATOR.hubHost}/emulators`);
  if (!hub.ok) {
    row('Emulator起動', 'fail', 'ローカルの Emulator Hub を確認できませんでした');
    return false;
  }
  const body = (await hub.json()) as Record<string, { host?: string; port?: number }>;
  const local = (name: string, port: number) => body[name]?.host === '127.0.0.1' && body[name]?.port === port;
  if (!local('auth', 9099) || !local('firestore', 8282) || !local('storage', 9199)) {
    row('Emulator起動', 'fail', 'Hub の接続先が Auth、Firestore、Storage のローカルポートではありません');
    return false;
  }
  row('Emulator起動', 'pass', 'demo-procom-local 向けのローカルポートを確認');
  return true;
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
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get('location') ?? '' };
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
  if (!refuseKeyRead()) return 1;
  if (!(await emulatorReady())) {
    console.error('結合テストは開始しません。');
    return 1;
  }
  if (await portOpen(EMULATOR.nextPort)) {
    row('Next', 'fail', '127.0.0.1:3100 が使用中のため、接続先不明のサーバーではテストしません');
    return 1;
  }

  applyIsolatedEnv();
  if (process.env.FIREBASE_KEY_PATH) {
    row('接続防止', 'fail', '鍵パスが空ではありません');
    return 1;
  }

  const { admin } = await import('../../app/lib/firebase');
  const options = admin.app().options;
  const credentialName = (options.credential as { constructor?: { name?: string } } | undefined)?.constructor?.name ?? '';
  const marked = (globalThis as { __procomEmulatorCredential?: boolean }).__procomEmulatorCredential === true;
  if (
    options.projectId !== EMULATOR.projectId ||
    options.storageBucket !== EMULATOR.storageBucket ||
    !marked ||
    credentialName === 'ApplicationDefaultCredential'
  ) {
    row('接続防止', 'fail', 'Admin SDK の初期化先がローカル Emulator ではありません');
    return 1;
  }
  const { firebaseApp } = await import('../../app/lib/firebaseClient');
  const { getFirestore } = await import('firebase/firestore');
  const { getStorage } = await import('firebase/storage');
  const firestoreHost = (getFirestore(firebaseApp) as unknown as { _settings?: { host?: string } })._settings?.host ?? '';
  const storageHost = (getStorage(firebaseApp) as unknown as { host?: string }).host ?? '';
  if (
    firebaseApp.options.projectId !== EMULATOR.projectId ||
    !firestoreHost.includes('127.0.0.1:8282') ||
    !storageHost.includes('127.0.0.1:9199')
  ) {
    row('接続防止', 'fail', 'Client SDK の接続先がローカル Emulator ではありません');
    return 1;
  }
  row('SDK接続先', 'pass', 'Admin は鍵なし、Client は demo-procom-local');

  const logs: string[] = [];
  const next = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
    cwd: join(import.meta.dirname, '../..'),
    env: process.env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const keepLog = (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (!line || /PRIVATE|AIza|SESSION_PASSWORD|BEGIN /.test(line)) continue;
      logs.push(line);
      if (logs.length > 40) logs.shift();
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
      row('Next', 'fail', '隔離した Next の起動を確認できませんでした');
      console.error(logs.join('\n'));
      return 1;
    }
    row('Next', 'pass', '127.0.0.1:3100 で Emulator 用の開発サーバーを起動');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const probeEmail = `probe-${suffix}@demo.local`;
    const probe = await admin.auth().createUser({ email: probeEmail, password: PASSWORD, displayName: 'Probe' });
    const probeToken = await signIn(probeEmail, PASSWORD);
    const probeJar: CookieJar = new Map();
    const probeLogin = await sessionLogin(probeToken, probeJar);
    const probeDoc = await db.collection('users').doc(probe.uid).get();
    if (probeLogin.status !== 200 || probeDoc.exists) {
      row('サーバー接続先', 'fail', 'ログイン検証がローカル Emulator で完結しませんでした');
      return 1;
    }
    await admin.auth().deleteUser(probe.uid);
    row('サーバー接続先', 'pass', 'サーバーは Emulator の ID トークンだけを検証した');

    const mainEmail = `main-${suffix}@demo.local`;
    const mainName = `EmuMain${suffix}`;
    const mainTitle = `Title${suffix}`;
    const mainJar: CookieJar = new Map();
    const registered = await request('/api/register', mainJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: mainName, email: mainEmail, password: PASSWORD }),
    });
    const registeredJson = registered.status === 200 ? (JSON.parse(registered.text) as { redirectTo?: string }) : {};
    const mainUser = await admin.auth().getUserByEmail(mainEmail);
    const mainSnap = await db.collection('users').doc(mainUser.uid).get();
    const mainProfile = profileOf(mainSnap.data());
    const claims = (await admin.auth().getUser(mainUser.uid)).customClaims ?? {};
    row(
      '1. 新規アカウント作成',
      registered.status === 200 && mainSnap.exists ? 'pass' : 'fail',
      `HTTP ${registered.status}`
    );
    row(
      '2. required',
      mainProfile.onboardingStatus === 'required' && claims.procomRegistration == null ? 'pass' : 'fail',
      `status=${String(mainProfile.onboardingStatus)}`
    );
    const mainSettings =
      mainProfile.settings && typeof mainProfile.settings === 'object'
        ? (mainProfile.settings as { blockLayoutVersion?: unknown; sectionOrder?: unknown; calendarLayout?: unknown })
        : {};
    row(
      '2b. 空のブロック配置',
      mainSettings.blockLayoutVersion === 1 &&
        Array.isArray(mainSettings.sectionOrder) &&
        mainSettings.sectionOrder.length === 0 &&
        mainSettings.calendarLayout === 'section'
        ? 'pass'
        : 'fail',
      `version=${String(mainSettings.blockLayoutVersion)} blocks=${Array.isArray(mainSettings.sectionOrder) ? mainSettings.sectionOrder.length : 'none'}`
    );
    const setup = await request('/profile/setup', mainJar);
    row(
      '3. /profile/setup',
      registeredJson.redirectTo === '/profile/setup' &&
        setup.status === 200 &&
        setup.text.includes('保存して中断') &&
        setup.text.includes(mainName)
        ? 'pass'
        : 'fail',
      `redirect=${registeredJson.redirectTo ?? ''} page=${setup.status}`
    );

    const draft = await request('/api/profile/setup', mainJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: mainName, title: mainTitle }),
    });
    const drafted = profileOf((await db.collection('users').doc(mainUser.uid).get()).data());
    row(
      '4. 名前と肩書き',
      draft.status === 200 && drafted.name === mainName && drafted.title === mainTitle ? 'pass' : 'fail',
      `HTTP ${draft.status}`
    );
    const draftedSettings =
      drafted.settings && typeof drafted.settings === 'object'
        ? (drafted.settings as { blockLayoutVersion?: unknown; sectionOrder?: unknown })
        : {};
    row(
      '4b. 途中保存後も空の配置',
      draftedSettings.blockLayoutVersion === 1 &&
        Array.isArray(draftedSettings.sectionOrder) &&
        draftedSettings.sectionOrder.length === 0
        ? 'pass'
        : 'fail',
      `version=${String(draftedSettings.blockLayoutVersion)}`
    );

    const uploaded = await request('/api/profile/setup/photo', mainJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: PHOTO }),
    });
    const uploadedJson = uploaded.status === 200 ? (JSON.parse(uploaded.text) as { url?: string }) : {};
    const photoUrl = uploadedJson.url ?? '';
    const objectPath = decodeURIComponent(new URL(photoUrl || 'https://invalid.example/').pathname.split('/o/')[1] ?? '');
    const [exists] = photoUrl ? await bucket.file(objectPath).exists() : [false];
    const [meta] = exists ? await bucket.file(objectPath).getMetadata() : [undefined];
    const owned =
      photoUrl.startsWith(`https://firebasestorage.googleapis.com/v0/b/${EMULATOR.storageBucket}/o/`) &&
      objectPath === `photos/${mainUser.uid}/${objectPath.split('/')[2] ?? ''}` &&
      exists &&
      meta?.contentType === 'image/jpeg' &&
      !photoUrl.includes('procom-fea80');
    row('5. 画像アップロード', uploaded.status === 200 && owned ? 'pass' : 'fail', `HTTP ${uploaded.status}`);
    row('6. Storageの所有', owned ? 'pass' : 'fail', exists ? 'エミュレータ上の本人パス' : 'オブジェクトなし');

    const saved = await request('/api/profile/setup', mainJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: mainName, title: mainTitle, photoUrl }),
    });
    const mid = profileOf((await db.collection('users').doc(mainUser.uid).get()).data());
    row(
      '7. 途中保存',
      saved.status === 200 && mid.onboardingStatus === 'required' && mid.name === mainName && mid.title === mainTitle
        ? 'pass'
        : 'fail',
      `HTTP ${saved.status}`
    );

    const hiddenPage = await request(`/user/${mainUser.uid}`, new Map());
    const hiddenApi = await request(`/api/user/${mainUser.uid}`, new Map());
    const hiddenBanner = await request(`/api/banner-links?uid=${mainUser.uid}`, new Map());
    row(
      '10. 未完了の公開ページ',
      hiddenPage.status === 200 &&
        hiddenPage.text.includes('このプロフィールは公開されていません') &&
        !hiddenPage.text.includes(mainName) &&
        !hiddenPage.text.includes(mainTitle)
        ? 'pass'
        : 'fail',
      `HTTP ${hiddenPage.status}`
    );
    row(
      '11. 未完了の公開API',
      hiddenApi.status === 404 &&
        hiddenBanner.status === 404 &&
        !hiddenApi.text.includes(mainName) &&
        !hiddenBanner.text.includes(mainName)
        ? 'pass'
        : 'fail',
      `user=${hiddenApi.status} banner=${hiddenBanner.status}`
    );

    const loggedOut = await request('/api/logout', mainJar);
    const afterLogout = await request('/profile/setup', mainJar);
    const again = await sessionLogin(await signIn(mainEmail, PASSWORD), mainJar);
    const againJson = again.status === 200 ? (JSON.parse(again.text) as { redirectTo?: string }) : {};
    const resumedPage = await request('/profile/setup', mainJar);
    const resumed = profileOf((await db.collection('users').doc(mainUser.uid).get()).data());
    row(
      '8. ログアウトと再ログイン',
      loggedOut.status >= 300 &&
        loggedOut.status < 400 &&
        afterLogout.status >= 300 &&
        afterLogout.location.includes('/login') &&
        again.status === 200
        ? 'pass'
        : 'fail',
      `logout=${loggedOut.status} login=${again.status}`
    );
    row(
      '9. 保存内容から再開',
      againJson.redirectTo === '/profile/setup' &&
        resumedPage.status === 200 &&
        resumedPage.text.includes(mainName) &&
        resumedPage.text.includes(mainTitle) &&
        resumed.name === mainName &&
        resumed.onboardingStatus === 'required'
        ? 'pass'
        : 'fail',
      `redirect=${againJson.redirectTo ?? ''}`
    );

    const completed = await request('/api/profile/setup/complete', mainJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: mainName, title: mainTitle, photoUrl }),
    });
    const done = profileOf((await db.collection('users').doc(mainUser.uid).get()).data());
    const doneLogin = await sessionLogin(await signIn(mainEmail, PASSWORD), mainJar);
    const doneJson = doneLogin.status === 200 ? (JSON.parse(doneLogin.text) as { redirectTo?: string }) : {};
    const publicPage = await request(`/user/${mainUser.uid}`, new Map());
    const listed = await db.collection('publicProfiles').doc(mainUser.uid).get();
    row('12. 公開で complete', completed.status === 200 && done.onboardingStatus === 'complete' ? 'pass' : 'fail', `HTTP ${completed.status}`);
    const doneSettings =
      done.settings && typeof done.settings === 'object'
        ? (done.settings as { blockLayoutVersion?: unknown; sectionOrder?: unknown; calendarLayout?: unknown })
        : {};
    row(
      '12b. 完了後も空の配置',
      doneSettings.blockLayoutVersion === 1 &&
        Array.isArray(doneSettings.sectionOrder) &&
        doneSettings.sectionOrder.length === 0 &&
        doneSettings.calendarLayout === 'section'
        ? 'pass'
        : 'fail',
      `version=${String(doneSettings.blockLayoutVersion)}`
    );
    row('13. 自分のプロフィールへ', doneJson.redirectTo === `/user/${mainUser.uid}` ? 'pass' : 'fail', doneJson.redirectTo ?? '');
    row(
      '14. 公開ページ',
      publicPage.status === 200 &&
        publicPage.text.includes(mainName) &&
        publicPage.text.includes(mainTitle) &&
        !publicPage.text.includes('このプロフィールは公開されていません')
        ? 'pass'
        : 'fail',
      `HTTP ${publicPage.status}`
    );
    row(
      '15. publicProfiles',
      listed.exists && listed.get('name') === mainName ? 'pass' : 'fail',
      listed.exists ? '掲載文書あり' : '掲載文書なし'
    );

    const hiddenEmail = `hidden-${suffix}@demo.local`;
    const hiddenName = `EmuHidden${suffix}`;
    const hiddenJar: CookieJar = new Map();
    await request('/api/register', hiddenJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: hiddenName, email: hiddenEmail, password: PASSWORD }),
    });
    const hiddenUser = await admin.auth().getUserByEmail(hiddenEmail);
    const sync = await request('/api/internal/listing-sync', new Map(), {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.LISTING_SYNC_SECRET ?? ''}` },
    });
    const syncJson = sync.status === 200 ? (JSON.parse(sync.text) as { processed?: number }) : {};
    const sitemap = await request('/sitemaps/profiles/0', new Map());
    const usersPage = await request('/users', new Map());
    const pages = await db.collection('directoryPages').get();
    const pageText = pages.docs.map((doc) => JSON.stringify(doc.data())).join('\n');
    const seq = listed.exists ? (await db.collection('publicProfiles').doc(mainUser.uid).get()).get('seq') : null;
    row(
      '16. 一覧とサイトマップ',
      sync.status === 200 &&
        typeof seq === 'number' &&
        sitemap.text.includes(`/user/${mainUser.uid}`) &&
        !sitemap.text.includes(`/user/${hiddenUser.uid}`) &&
        pageText.includes(mainUser.uid) &&
        !pageText.includes(hiddenUser.uid) &&
        usersPage.text.includes(mainName) &&
        !usersPage.text.includes(hiddenName)
        ? 'pass'
        : 'fail',
      `sync=${sync.status} processed=${syncJson.processed ?? 0}`
    );

    const legacyEmail = `legacy-${suffix}@demo.local`;
    const legacyName = `EmuLegacy${suffix}`;
    const legacyAuth = await admin.auth().createUser({
      email: legacyEmail,
      password: PASSWORD,
      displayName: legacyName,
    });
    await db.collection('users').doc(legacyAuth.uid).create({
      uid: legacyAuth.uid,
      email: legacyEmail,
      password: '',
      guard: 'legacy-keep',
      profile: {
        name: legacyName,
        title: '既存肩書き',
        bio: 'keep-bio',
        photos: [],
        youtubeChannelId: '',
        instagramPostUrl: '',
        xUsername: '',
        tiktokUrls: [],
        calendarEvents: [],
      },
    });
    const legacyJar: CookieJar = new Map();
    const legacyLogin = await sessionLogin(await signIn(legacyEmail, PASSWORD), legacyJar);
    const legacyJson = legacyLogin.status === 200 ? (JSON.parse(legacyLogin.text) as { redirectTo?: string }) : {};
    const legacyAfter = (await db.collection('users').doc(legacyAuth.uid).get()).data() ?? {};
    const legacyProfile = profileOf(legacyAfter);
    row(
      '17. 既存ユーザーは初期設定不要',
      legacyJson.redirectTo === `/user/${legacyAuth.uid}` &&
        !Object.prototype.hasOwnProperty.call(legacyProfile, 'onboardingStatus') &&
        !Object.prototype.hasOwnProperty.call(legacyProfile, 'settings') &&
        legacyAfter.guard === 'legacy-keep'
        ? 'pass'
        : 'fail',
      legacyJson.redirectTo ?? ''
    );
    const edited = await request(`/api/user/${legacyAuth.uid}`, legacyJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: legacyName, title: '更新した肩書き' } }),
    });
    const editedDoc = (await db.collection('users').doc(legacyAuth.uid).get()).data() ?? {};
    const editedProfile = profileOf(editedDoc);
    row(
      '18. 既存ユーザーの編集',
      edited.status === 200 &&
        editedProfile.title === '更新した肩書き' &&
        editedProfile.name === legacyName &&
        !Object.prototype.hasOwnProperty.call(editedProfile, 'onboardingStatus') &&
        editedDoc.guard === 'legacy-keep'
        ? 'pass'
        : 'fail',
      `HTTP ${edited.status}`
    );

    const staleEmail = `stale-${suffix}@demo.local`;
    const staleAuth = await admin.auth().createUser({
      email: staleEmail,
      password: PASSWORD,
      displayName: `EmuStale${suffix}`,
    });
    await admin.auth().setCustomUserClaims(staleAuth.uid, { procomRegistration: 'pending' });
    const staleToken = await signIn(staleEmail, PASSWORD);
    await admin.auth().setCustomUserClaims(staleAuth.uid, null);
    const staleJar: CookieJar = new Map();
    const staleLogin = await sessionLogin(staleToken, staleJar);
    const staleDoc = await db.collection('users').doc(staleAuth.uid).get();
    const staleKept = staleLogin.status === 200 && !staleDoc.exists;
    await admin.auth().setCustomUserClaims(staleAuth.uid, { procomRegistration: 'pending', role: 'keep-role' });
    const freshLogin = await sessionLogin(await signIn(staleEmail, PASSWORD), new Map());
    const created = await db.collection('users').doc(staleAuth.uid).get();
    const createdProfile = profileOf(created.data());
    const createdAt = created.get('createdAt');
    await admin.auth().setCustomUserClaims(staleAuth.uid, { procomRegistration: 'pending', role: 'keep-role' });
    const afterFailedClear = await db.collection('users').doc(staleAuth.uid).get();
    const keptAfterClaim = profileOf(afterFailedClear.data()).name === createdProfile.name && afterFailedClear.get('createdAt')?.isEqual?.(createdAt);
    const second = await sessionLogin(await signIn(staleEmail, PASSWORD), new Map());
    const secondDoc = await db.collection('users').doc(staleAuth.uid).get();
    const secondClaims = (await admin.auth().getUser(staleAuth.uid)).customClaims ?? {};
    const resumeKept =
      freshLogin.status === 200 &&
      createdProfile.onboardingStatus === 'required' &&
      keptAfterClaim &&
      second.status === 200 &&
      profileOf(secondDoc.data()).name === createdProfile.name &&
      secondDoc.get('createdAt')?.isEqual?.(createdAt) &&
      secondClaims.procomRegistration == null &&
      secondClaims.role === 'keep-role';

    const pendingEmail = `pending-${suffix}@demo.local`;
    const pendingAuth = await admin.auth().createUser({
      email: pendingEmail,
      password: PASSWORD,
      displayName: `EmuPending${suffix}`,
    });
    await admin.auth().setCustomUserClaims(pendingAuth.uid, { procomRegistration: 'pending' });
    const pendingRetry = await request('/api/register', new Map(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: `EmuPending${suffix}`, email: pendingEmail, password: PASSWORD }),
    });
    const pendingStill = await admin.auth().getUser(pendingAuth.uid);
    const pendingDoc = await db.collection('users').doc(pendingAuth.uid).get();

    const bareEmail = `bare-${suffix}@demo.local`;
    const bareAuth = await admin.auth().createUser({ email: bareEmail, password: PASSWORD, displayName: 'Bare' });
    const bareRetry = await request('/api/register', new Map(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: `EmuBare${suffix}`, email: bareEmail, password: PASSWORD }),
    });
    const bareStill = await admin.auth().getUser(bareAuth.uid).then(() => true).catch(() => false);
    const bareDoc = await db.collection('users').doc(bareAuth.uid).get();

    const raceEmail = `race-${suffix}@demo.local`;
    const raceBody = JSON.stringify({ username: `EmuRace${suffix}`, email: raceEmail, password: PASSWORD });
    const raced = await Promise.all([
      request('/api/register', new Map(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: raceBody }),
      request('/api/register', new Map(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: raceBody }),
    ]);
    const raceUser = await admin.auth().getUserByEmail(raceEmail);
    const raceDoc = await db.collection('users').doc(raceUser.uid).get();
    const raceCodes = raced.map((item) => item.status).sort();

    const loginRaceEmail = `loginrace-${suffix}@demo.local`;
    const loginRace = await admin.auth().createUser({
      email: loginRaceEmail,
      password: PASSWORD,
      displayName: `EmuLogin${suffix}`,
    });
    await admin.auth().setCustomUserClaims(loginRace.uid, { procomRegistration: 'pending' });
    const loginToken = await signIn(loginRaceEmail, PASSWORD);
    const loginRaced = await Promise.all([
      sessionLogin(loginToken, new Map()),
      sessionLogin(loginToken, new Map()),
    ]);
    const loginRaceDoc = await db.collection('users').doc(loginRace.uid).get();
    row(
      '19. 登録失敗と復旧',
      staleKept &&
        resumeKept &&
        pendingRetry.status === 409 &&
        pendingRetry.text.includes('ログイン') &&
        pendingStill.uid === pendingAuth.uid &&
        !pendingDoc.exists &&
        bareRetry.status === 409 &&
        bareStill &&
        !bareDoc.exists &&
        raceCodes[0] === 200 &&
        raceCodes[1] === 409 &&
        raceDoc.exists &&
        loginRaced.every((item) => item.status === 200) &&
        loginRaceDoc.exists &&
        profileOf(loginRaceDoc.data()).onboardingStatus === 'required'
        ? 'pass'
        : 'fail',
      `stale=${staleKept} resume=${resumeKept} retry=${pendingRetry.status}/${bareRetry.status} race=${raceCodes.join(',')}`
    );

    const otherEmail = `other-${suffix}@demo.local`;
    const otherJar: CookieJar = new Map();
    await request('/api/register', otherJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: `EmuOther${suffix}`, email: otherEmail, password: PASSWORD }),
    });
    const beforeCross = profileOf((await db.collection('users').doc(mainUser.uid).get()).data());
    const crossSetup = await request('/api/profile/setup', otherJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid: mainUser.uid, name: 'HijackName', title: 'HijackTitle' }),
    });
    const crossProfile = await request(`/api/user/${mainUser.uid}`, otherJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: { name: 'HijackName', title: 'HijackTitle' } }),
    });
    const crossRead = await request(`/api/user/${hiddenUser.uid}`, otherJar);
    const afterCross = profileOf((await db.collection('users').doc(mainUser.uid).get()).data());
    row(
      '20. 他人のプロフィールは編集できない',
      crossSetup.status === 403 &&
        crossProfile.status === 403 &&
        crossRead.status === 404 &&
        afterCross.name === beforeCross.name &&
        afterCross.title === beforeCross.title
        ? 'pass'
        : 'fail',
      `setup=${crossSetup.status} profile=${crossProfile.status} read=${crossRead.status}`
    );
  } finally {
    stopChild(next);
  }

  const failed = rows.some((item) => item.status === 'fail');
  console.log(failed ? 'onboarding-integration failed' : 'onboarding-integration ok');
  return failed ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '結合テストが停止しました';
    console.error(message.includes('PRIVATE') ? '結合テストが停止しました' : message);
    process.exit(1);
  });
