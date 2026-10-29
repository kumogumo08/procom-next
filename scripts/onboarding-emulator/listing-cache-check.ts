/**
 * 退会後の一覧キャッシュ。demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx --import ./scripts/onboarding-emulator/register-server-only.mjs scripts/onboarding-emulator/listing-cache-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { emptyListingState, enqueueListing, LISTING_PAGE_SIZE, stepListing } from '../../app/lib/listing/engine';
import { PUBLIC_USERS_PAGE_SIZE } from '../../app/lib/publicUserDirectory';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const ROOT = join(import.meta.dirname, '../..');
const suffix = Date.now().toString(36);
const FUTURE = Date.now() + 86_400_000;

type Status = 'pass' | 'fail';
const rows: Array<{ item: string; status: Status; note: string }> = [];

function absent(text: string, parts: string[]): string {
  const missing = parts.filter((part) => part && !text.includes(part));
  return missing.length === 0 ? 'なし' : missing.join(' ');
}

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

async function waitPortClosed(port: number): Promise<boolean> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (!(await portOpen(port))) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
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
): Promise<{ status: number; text: string; cacheControl: string }> {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set('cookie', cookie);
  const res = await fetch(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' });
  remember(res, jar);
  return {
    status: res.status,
    text: await res.text(),
    cacheControl: res.headers.get('cache-control') ?? '',
  };
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

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function checkSources(): void {
  const legacy = source('app/lib/listing/legacyDirectory.ts');
  const spotlight = source('app/lib/listing/spotlightSource.ts');
  const listing = source('app/lib/listing/firestoreListing.ts');
  const cache = source('app/lib/listing/listingCache.ts');
  const deletion = source('app/lib/accountDeletion.ts');
  const syncRoute = source('app/api/internal/listing-sync/route.ts');
  const workflow = source('.github/workflows/listing-sync.yml');
  const middleware = source('middleware.ts');
  const nextConfig = source('next.config.mjs');
  const topPage = source('app/top/page.tsx');
  const usersPage = source('app/users/page.tsx');
  const worker = listing.slice(listing.indexOf('export async function runListingWorker'));
  const listingTags = (listing.match(/tags: \[LISTING_CACHE_TAG\]/g) ?? []).length;
  const pageTags = (listing.match(/tags: \[LISTING_PAGES_CACHE_TAG\]/g) ?? []).length;
  const spotlightTags = (spotlight.match(/tags: \[LISTING_CACHE_TAG\]/g) ?? []).length;
  row(
    'コード: キャッシュタグ',
    legacy.includes('tags: [LISTING_CACHE_TAG]') &&
      legacy.includes('revalidate: 60') &&
      spotlightTags === 2 &&
      spotlight.includes('revalidate: SPOTLIGHT_SOURCE_REVALIDATE_SECONDS') &&
      listingTags === 2 &&
      pageTags === 2,
    '一覧5件は listing、固定ページとページ数は listing-pages。TTLは維持'
  );
  row(
    'コード: ページ数',
    PUBLIC_USERS_PAGE_SIZE === 20 && LISTING_PAGE_SIZE === 20,
    `旧 ${PUBLIC_USERS_PAGE_SIZE} / 新 ${LISTING_PAGE_SIZE}`
  );
  row(
    'コード: 無効化の位置',
    deletion.includes('invalidateListingAfterUnpublish()') &&
      deletion.includes('invalidateListingPages()') &&
      deletion.includes('listingOutboxPending') &&
      !worker.includes('revalidateTag') &&
      !worker.includes('invalidateListing') &&
      !syncRoute.includes('revalidate') &&
      !workflow.includes('revalidate'),
    '退会処理だけ。掲載ワーカーと定期同期からは呼ばない'
  );
  row(
    'コード: 読み取りを増やさない',
    !cache.includes('firebase') && !cache.includes('db.') && cache.includes('catch'),
    '無効化自体はFirestoreを読まない。退会時のoutbox確認は1回'
  );
  row(
    'コード: 共有キャッシュ',
    nextConfig.includes('expireTime: 120') &&
      topPage.includes('export const revalidate = 60') &&
      usersPage.includes('export const revalidate = 60') &&
      !middleware.includes('stale-while-revalidate'),
    'expireTimeは120秒。ISRは60秒のまま。一覧HTMLはmiddlewareで上書きしない'
  );

  let state = emptyListingState();
  state = enqueueListing(state, 'a', 'upsert', {
    name: 'A',
    title: '',
    photoUrl: '',
    sortAtMs: 1,
    missingCreatedAt: false,
    hasPhoto: false,
    contentUpdatedAtMs: null,
    searchTokens: [],
    categorySlugs: [],
  }).state;
  state = stepListing(state, 'a');
  const pageNo = state.profiles.get('a')?.pageNo ?? null;
  state = enqueueListing(state, 'a', 'remove').state;
  const kept = state.outbox.get('a');
  let again = emptyListingState();
  if (kept) again.outbox.set('a', kept);
  again = enqueueListing(again, 'a', 'remove').state;
  const repeated = again.outbox.get('a');
  again.pages.set(pageNo ?? 0, [{ uid: 'a', name: 'A', title: '', photoUrl: '' }]);
  again = stepListing(again, 'a');
  const cards = pageNo == null ? [] : (again.pages.get(pageNo) ?? []);
  row(
    'コード: 再enqueue後もページを消せる',
    pageNo === 1 && kept?.pageNo === 1 && repeated?.pageNo === 1 && cards.every((card) => card.uid !== 'a'),
    `page=${pageNo ?? 'なし'}`
  );
}

type ProfileInput = {
  name: string;
  title: string;
  photo?: string;
  onboarding?: 'complete';
  pending?: boolean;
  createdAtMs: number;
};

async function main(): Promise<number> {
  if (process.env.PROCOM_EMULATOR !== '1' || process.env.FIREBASE_PROJECT_ID !== EMULATOR.projectId) {
    console.error('Emulator 隔離が無効です。テストは開始しません。');
    return 1;
  }
  if (process.env.FIREBASE_KEY_PATH) {
    console.error('鍵パスが空ではありません。テストは開始しません。');
    return 1;
  }
  checkSources();

  let threw = false;
  try {
    const { invalidateListingAfterUnpublish, invalidateListingPages } = await import('../../app/lib/listing/listingCache');
    invalidateListingAfterUnpublish();
    invalidateListingPages();
  } catch {
    threw = true;
  }
  row('コード: 無効化失敗でも例外にしない', !threw, 'リクエスト外の revalidate は退会を止めない');

  const ports = [9099, 8282, 9199, 4401];
  const already = await Promise.all(ports.map((port) => portOpen(port)));
  if (already.some(Boolean) && !already.every(Boolean)) {
    console.error('Emulator のポートが中途半端に使用中です。');
    return 1;
  }
  if (await portOpen(EMULATOR.nextPort)) {
    console.error('127.0.0.1:3100 が使用中です。');
    return 1;
  }

  let emulator: ChildProcess | null = null;
  let next: ChildProcess | null = null;
  const created: string[] = [];
  const authUsers: string[] = [];

  if (!already.every(Boolean)) {
    emulator = spawn(
      'npx',
      ['firebase', 'emulators:start', '--only', 'auth,firestore,storage', '--project', EMULATOR.projectId, '--config', 'scripts/onboarding-emulator/firebase.json'],
      { cwd: ROOT, shell: true, stdio: 'ignore' }
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

  let admin: Awaited<typeof import('../../app/lib/firebase')>['admin'];
  let db: Awaited<typeof import('../../app/lib/firebase')>['db'];
  try {
    const firebase = await import('../../app/lib/firebase');
    admin = firebase.admin;
    db = firebase.db;
  } catch (err: unknown) {
    stopChild(emulator);
    console.error(err instanceof Error ? err.name : 'error');
    return 1;
  }
  const options = admin.app().options;
  if (options.projectId !== EMULATOR.projectId) {
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

  const logs: string[] = [];
  const keepLog = (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (!line || /PRIVATE|AIza|SESSION_PASSWORD|ACCOUNT_DELETION_|BEGIN |Bearer /.test(line)) continue;
      logs.push(line);
      if (logs.length > 40) logs.shift();
    }
  };

  function clearFetchCache(): void {
    rmSync(join(ROOT, '.next', 'cache', 'fetch-cache'), { recursive: true, force: true });
  }

  function startNext(directoryReady: '0' | '1'): void {
    clearFetchCache();
    next = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
      cwd: ROOT,
      env: { ...process.env, LISTING_DIRECTORY_READY: directoryReady },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    next.stdout?.on('data', keepLog);
    next.stderr?.on('data', keepLog);
  }

  async function waitNext(): Promise<boolean> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (next?.exitCode != null) return false;
      try {
        const res = await fetch(`${ORIGIN}/login`, { redirect: 'manual' });
        if (res.status < 500) return true;
      } catch {
        // 起動待ち
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  async function stopNext(): Promise<void> {
    stopChild(next);
    next = null;
    await waitPortClosed(EMULATOR.nextPort);
  }

  async function putUser(label: string, profile: ProfileInput, withAuth: boolean): Promise<{ uid: string; email: string }> {
    const email = `${label}-${suffix}@demo.local`;
    const uid = withAuth
      ? (await admin.auth().createUser({ email, password: PASSWORD, displayName: label })).uid
      : `cache${label}${suffix}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 120);
    if (withAuth) authUsers.push(uid);
    created.push(uid);
    const body: Record<string, unknown> = {
      uid,
      email,
      createdAt: new Date(profile.createdAtMs),
      profile: {
        name: profile.name,
        title: profile.title,
        isPublic: true,
        ...(profile.onboarding ? { onboardingStatus: profile.onboarding } : {}),
        ...(profile.photo ? { photos: [{ url: profile.photo }] } : {}),
      },
    };
    if (profile.pending) body.deletionPending = true;
    await db.collection('users').doc(uid).set(body);
    return { uid, email };
  }

  async function pageOf(uid: string): Promise<number | null> {
    const snap = await db.collection('directoryPages').get();
    for (const doc of snap.docs) {
      const cards = doc.data().cards;
      if (!Array.isArray(cards)) continue;
      if (cards.some((card) => card && typeof card === 'object' && (card as { uid?: unknown }).uid === uid)) {
        const pageNo = Number(doc.id);
        return Number.isInteger(pageNo) ? pageNo : null;
      }
    }
    return null;
  }

  try {
    startNext('0');
    if (!(await waitNext())) {
      row('Next', false, '隔離した Next が起動しませんでした');
      console.error(logs.join('\n'));
      return 1;
    }

    const leaveName = `Qxleave${suffix}`;
    const stayName = `Qxstay${suffix}`;
    const legacyName = `Qxlegacy${suffix}`;
    const pendingName = `Qxpending${suffix}`;
    const leaveTitle = `QxleaveTitle${suffix}`;
    const stayTitle = `QxstayTitle${suffix}`;
    const leavePhoto = `https://example.com/qxleave-${suffix}.jpg`;
    const legacyPhoto = `https://example.com/qxlegacy-${suffix}.jpg`;

    const leave = await putUser('leave', {
      name: leaveName,
      title: leaveTitle,
      photo: leavePhoto,
      onboarding: 'complete',
      createdAtMs: FUTURE,
    }, true);
    const stay = await putUser('stay', {
      name: stayName,
      title: stayTitle,
      photo: `https://example.com/qxstay-${suffix}.jpg`,
      onboarding: 'complete',
      createdAtMs: FUTURE - 1000,
    }, true);
    await putUser('legacy', {
      name: legacyName,
      title: `QxlegacyTitle${suffix}`,
      photo: legacyPhoto,
      createdAtMs: FUTURE - 2000,
    }, false);
    await putUser('pending', {
      name: pendingName,
      title: `QxpendingTitle${suffix}`,
      onboarding: 'complete',
      pending: true,
      createdAtMs: FUTURE,
    }, false);
    for (let i = 0; i < 20; i += 1) {
      await putUser(`fill${i}`, {
        name: `Qxfill${suffix}${i}`,
        title: 'Fill',
        onboarding: 'complete',
        createdAtMs: FUTURE - 86_400_000 - i * 1000,
      }, false);
    }

    const jar: CookieJar = new Map();
    const users = await request('/users', jar);
    const page2 = await request('/users?page=2', jar);
    const search = await request(`/api/users?q=${encodeURIComponent(leaveName)}`, jar);
    const top = await request('/top', jar);
    const category = await request('/api/category-users?category=new&withPhotos=1', jar);
    const warmed =
      users.status === 200 &&
      users.text.includes(leaveName) &&
      users.text.includes(leaveTitle) &&
      users.text.includes(leavePhoto) &&
      users.text.includes(stayName) &&
      users.text.includes(legacyName) &&
      !users.text.includes(pendingName) &&
      search.text.includes(leaveName) &&
      top.status === 200 &&
      top.text.includes(leaveName) &&
      top.text.includes(legacyName) &&
      category.status === 200 &&
      category.text.includes(leaveName);
    row(
      'HTTP: 公開ユーザーと旧ユーザー',
      warmed,
      warmed
        ? `users=${users.status} search=${search.status} top=${top.status} category=${category.status}`
        : `users欠=${absent(users.text, [leaveName, leaveTitle, leavePhoto, stayName, legacyName])} search欠=${absent(search.text, [leaveName])} top欠=${absent(top.text, [leaveName, legacyName])} category欠=${absent(category.text, [leaveName])}`
    );
    row('HTTP: 退会途中は旧一覧に出ない', users.status === 200 && !users.text.includes(pendingName), 'キャッシュ生成前から除外');
    row(
      'HTTP: ページング',
      page2.status === 200 && !page2.text.includes(leaveName),
      `page2=${page2.status}`
    );
    const devNoStore = users.cacheControl === 'no-store, must-revalidate';
    const sharedHeader =
      users.cacheControl.includes('s-maxage=60') && users.cacheControl.includes('stale-while-revalidate=60');
    row(
      'HTTP: 共有キャッシュヘッダ',
      devNoStore || sharedHeader,
      devNoStore ? 'next dev は no-store。本番ヘッダはコード確認' : users.cacheControl || 'なし'
    );

    const anonymous = await request('/api/account/delete', new Map(), { method: 'DELETE' });
    const still = await request('/users', jar);
    row(
      'HTTP: 退会失敗では残る',
      anonymous.status === 401 && still.text.includes(leaveName) && still.text.includes(stayName),
      `delete=${anonymous.status}`
    );

    const login = await request('/api/session/login', jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: await signIn(leave.email, PASSWORD) }),
    });
    const deleted = await request('/api/account/delete', jar, { method: 'DELETE' });
    const afterUsers = await request('/users', jar);
    const afterPage2 = await request('/users?page=2', jar);
    const afterSearch = await request(`/api/users?q=${encodeURIComponent(leaveName)}`, jar);
    const afterStaySearch = await request(`/api/users?q=${encodeURIComponent(stayName)}`, jar);
    const afterTop = await request('/top', jar);
    const afterCategory = await request('/api/category-users?category=new&withPhotos=1', jar);
    const leaveDoc = await db.collection('users').doc(leave.uid).get();
    const stayDoc = await db.collection('users').doc(stay.uid).get();
    const gone =
      deleted.status === 200 &&
      !afterUsers.text.includes(leaveName) &&
      !afterUsers.text.includes(leaveTitle) &&
      !afterUsers.text.includes(leavePhoto) &&
      afterUsers.text.includes(stayName) &&
      afterUsers.text.includes(legacyName) &&
      !afterPage2.text.includes(leaveName) &&
      !afterSearch.text.includes(leaveName) &&
      afterStaySearch.text.includes(stayName) &&
      !afterTop.text.includes(leaveName) &&
      !afterTop.text.includes(leavePhoto) &&
      afterTop.text.includes(legacyName) &&
      !afterCategory.text.includes(leaveName) &&
      !leaveDoc.exists &&
      stayDoc.exists;
    row(
      'HTTP: 退会後の旧一覧・検索・Spotlight',
      login.status === 200 && gone,
      `login=${login.status} delete=${deleted.status} users=${afterUsers.status} search=${afterSearch.status} top=${afterTop.status}`
    );

    await stopNext();
    if (await portOpen(EMULATOR.nextPort)) {
      row('Next再起動', false, '3100 が空になりませんでした');
      return 1;
    }

    startNext('1');
    if (!(await waitNext())) {
      row('Next新方式', false, '新方式の Next が起動しませんでした');
      console.error(logs.join('\n'));
      return 1;
    }

    const { enqueueUserListing, runListingWorker } = await import('../../app/lib/listing/firestoreListing');
    const listedName = `Qxlisted${suffix}`;
    const listedTitle = `QxlistedTitle${suffix}`;
    const listedPhoto = `https://example.com/qxlisted-${suffix}.jpg`;
    const listedStayName = `Qxlistedstay${suffix}`;
    const listed = await putUser('listed', {
      name: listedName,
      title: listedTitle,
      photo: listedPhoto,
      onboarding: 'complete',
      createdAtMs: FUTURE,
    }, true);
    const listedStay = await putUser('listedstay', {
      name: listedStayName,
      title: `QxlistedstayTitle${suffix}`,
      photo: `https://example.com/qxlistedstay-${suffix}.jpg`,
      onboarding: 'complete',
      createdAtMs: FUTURE - 1000,
    }, true);

    await enqueueUserListing(listed.uid);
    await enqueueUserListing(listedStay.uid);
    const beforePages = await pageOf(listed.uid);
    const worked = await runListingWorker('cache-check-seed');
    const seededPage = await pageOf(listed.uid);
    row(
      'HTTP前: directoryPagesの更新順',
      beforePages === null && seededPage !== null && worked.skippedLock === false,
      `before=${beforePages ?? 'なし'} after=${seededPage ?? 'なし'} processed=${worked.processed}`
    );
    if (seededPage === null) return 1;

    const listedJar: CookieJar = new Map();
    const fixedBefore = await request(`/users?page=${seededPage}`, listedJar);
    const newestBefore = await request('/users', listedJar);
    const listedSearchBefore = await request(`/api/users?q=${encodeURIComponent(listedName)}`, listedJar);
    const listedTopBefore = await request('/top', listedJar);
    const listedCategoryBefore = await request('/api/category-users?category=new&withPhotos=1', listedJar);
    const listedBeforeOk =
      fixedBefore.text.includes(listedName) &&
      newestBefore.text.includes(listedName) &&
      listedSearchBefore.text.includes(listedName) &&
      listedTopBefore.text.includes(listedName) &&
      listedCategoryBefore.text.includes(listedName);
    row(
      'HTTP: 新一覧の事前表示',
      listedBeforeOk,
      listedBeforeOk
        ? `page=${seededPage} fixed=${fixedBefore.status} newest=${newestBefore.status} search=${listedSearchBefore.status} top=${listedTopBefore.status}`
        : `fixed欠=${absent(fixedBefore.text, [listedName, listedTitle, listedPhoto])} newest欠=${absent(newestBefore.text, [listedName])} search欠=${absent(listedSearchBefore.text, [listedName])} top欠=${absent(listedTopBefore.text, [listedName])} category欠=${absent(listedCategoryBefore.text, [listedName])}`
    );

    const pageRef = db.collection('directoryPages').doc(String(seededPage));
    const original = await pageRef.get();
    const originalCards = original.data()?.cards;
    const stripped = Array.isArray(originalCards)
      ? originalCards.filter((card) => !(card && typeof card === 'object' && (card as { uid?: unknown }).uid === listed.uid))
      : [];
    await pageRef.set({ pageNo: seededPage, cards: stripped });
    const whileStale = await request(`/users?page=${seededPage}`, listedJar);
    const cacheHeld = whileStale.text.includes(listedName);
    await pageRef.set({ pageNo: seededPage, cards: originalCards });
    row(
      'HTTP: 事前生成キャッシュ',
      cacheHeld,
      cacheHeld ? 'Firestoreを消しても固定ページの応答に名前が残った' : 'このNext開発サーバーは固定ページを再取得した'
    );
    if (!cacheHeld) {
      await stopNext();
      startNext('1');
      if (!(await waitNext())) {
        row('Next再生成', false, 'キャッシュ確認後の再起動に失敗しました');
        return 1;
      }
      const rewarm = await request(`/users?page=${seededPage}`, new Map());
      if (!rewarm.text.includes(listedName)) {
        row('HTTP: 再生成', false, '掲載データがページに戻りませんでした');
        return 1;
      }
    }

    const listedLogin = await request('/api/session/login', listedJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: await signIn(listed.email, PASSWORD) }),
    });
    const listedDelete = await request('/api/account/delete', listedJar, { method: 'DELETE' });
    const fixedAfter = await request(`/users?page=${seededPage}`, listedJar);
    const newestAfter = await request('/users', listedJar);
    const listedSearchAfter = await request(`/api/users?q=${encodeURIComponent(listedName)}`, listedJar);
    const listedTopAfter = await request('/top', listedJar);
    const listedCategoryAfter = await request('/api/category-users?category=new&withPhotos=1', listedJar);
    const pageAfter = await pageOf(listed.uid);
    const stayPageAfter = await pageOf(listedStay.uid);
    const stayFixed =
      stayPageAfter === null || stayPageAfter === seededPage
        ? fixedAfter
        : await request(`/users?page=${stayPageAfter}`, listedJar);
    const listedDoc = await db.collection('users').doc(listed.uid).get();
    const listedProfile = await db.collection('publicProfiles').doc(listed.uid).get();
    row(
      'HTTP: 退会後の新一覧・検索・Spotlight',
      listedLogin.status === 200 &&
        listedDelete.status === 200 &&
        pageAfter === null &&
        stayPageAfter !== null &&
        !listedDoc.exists &&
        !listedProfile.exists &&
        !fixedAfter.text.includes(listedName) &&
        !fixedAfter.text.includes(listedTitle) &&
        !fixedAfter.text.includes(listedPhoto) &&
        stayFixed.text.includes(listedStayName) &&
        !newestAfter.text.includes(listedName) &&
        newestAfter.text.includes(listedStayName) &&
        !listedSearchAfter.text.includes(listedName) &&
        !listedTopAfter.text.includes(listedName) &&
        !listedTopAfter.text.includes(listedPhoto) &&
        listedTopAfter.text.includes(listedStayName) &&
        !listedCategoryAfter.text.includes(listedName),
      `delete=${listedDelete.status} page=${pageAfter ?? 'なし'} cacheHeld=${cacheHeld}`
    );

    const lockedName = `Qxlocked${suffix}`;
    const locked = await putUser('locked', {
      name: lockedName,
      title: `QxlockedTitle${suffix}`,
      photo: `https://example.com/qxlocked-${suffix}.jpg`,
      onboarding: 'complete',
      createdAtMs: FUTURE,
    }, true);
    await enqueueUserListing(locked.uid);
    const lockedSeed = await runListingWorker('cache-check-lock-seed');
    const lockedPage = await pageOf(locked.uid);
    if (lockedPage === null || lockedSeed.skippedLock) {
      row('HTTP: ページ未更新', false, `page=${lockedPage ?? 'なし'} skipped=${lockedSeed.skippedLock}`);
      return 1;
    }
    await stopNext();
    startNext('1');
    if (!(await waitNext())) {
      row('HTTP: ページ未更新', false, 'ロック確認の前に Next を再起動できませんでした');
      return 1;
    }
    const lockedJar: CookieJar = new Map();
    const lockedWarm = await request(`/users?page=${lockedPage}`, lockedJar);
    const lockedNewestBefore = await request('/users', lockedJar);
    const lockedSearchBefore = await request(`/api/users?q=${encodeURIComponent(lockedName)}`, lockedJar);
    await db.collection('directoryMeta').doc('lock').set({
      owner: 'cache-check-hold',
      untilMs: Date.now() + 120_000,
      fence: 9,
    });
    const lockedLogin = await request('/api/session/login', lockedJar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: await signIn(locked.email, PASSWORD) }),
    });
    const lockedDelete = await request('/api/account/delete', lockedJar, { method: 'DELETE' });
    const lockedFixed = await request(`/users?page=${lockedPage}`, lockedJar);
    const lockedNewest = await request('/users', lockedJar);
    const lockedSearch = await request(`/api/users?q=${encodeURIComponent(lockedName)}`, lockedJar);
    const lockedPageStill = await pageOf(locked.uid);
    const lockedDoc = await db.collection('users').doc(locked.uid).get();
    const lockedOutbox = await db.collection('listingOutbox').doc(locked.uid).get();
    const lockedOk =
      lockedWarm.text.includes(lockedName) &&
      lockedNewestBefore.text.includes(lockedName) &&
      lockedSearchBefore.text.includes(lockedName) &&
      lockedLogin.status === 200 &&
      lockedDelete.status === 200 &&
      !lockedDoc.exists &&
      lockedPageStill !== null &&
      lockedOutbox.exists &&
      lockedFixed.text.includes(lockedName) &&
      !lockedNewest.text.includes(lockedName) &&
      !lockedSearch.text.includes(lockedName);
    row(
      'HTTP: ページ更新前は固定ページに残る',
      lockedOk,
      lockedOk
        ? `delete=${lockedDelete.status} pageStill=${lockedPageStill ?? 'なし'}`
        : `warm欠=${absent(lockedWarm.text, [lockedName])} newest前欠=${absent(lockedNewestBefore.text, [lockedName])} search前欠=${absent(lockedSearchBefore.text, [lockedName])} login=${lockedLogin.status} delete=${lockedDelete.status} doc=${lockedDoc.exists} page=${lockedPageStill ?? 'なし'} outbox=${lockedOutbox.exists} fixed欠=${absent(lockedFixed.text, [lockedName])} newest後=${lockedNewest.text.includes(lockedName)} search後=${lockedSearch.text.includes(lockedName)}`
    );

    await db.collection('directoryMeta').doc('lock').delete();
    const drained = await runListingWorker('cache-check-drain');
    const drainedPage = await pageOf(locked.uid);
    const drainedHttp = await request(`/users?page=${lockedPage}`, lockedJar);
    row(
      'HTTP: 外部ワーカー後の固定ページ',
      drained.skippedLock === false && drainedPage === null,
      drainedHttp.text.includes(lockedName)
        ? 'Firestoreは更新済み。このNextの固定ページには名前が残った'
        : 'Firestore更新後のHTTPには名前が無かった'
    );

    return rows.some((item) => item.status === 'fail') ? 1 : 0;
  } finally {
    stopChild(next);
    try {
      await db.collection('directoryMeta').doc('lock').delete();
      for (const uid of created) {
        await db.collection('users').doc(uid).delete();
        await db.collection('publicProfiles').doc(uid).delete();
        await db.collection('listingOutbox').doc(uid).delete();
        await db.collection('listingTombstones').doc(uid).delete();
        await db.collection('accountDeletions').doc(uid).delete();
      }
      for (const uid of authUsers) {
        try {
          await admin.auth().deleteUser(uid);
        } catch {
          // 退会済み
        }
      }
    } catch (err: unknown) {
      console.error('後始末に失敗:', err instanceof Error ? err.name : 'error');
    }
    stopChild(emulator);
  }
}

main()
  .then((code) => {
    const failed = rows.filter((item) => item.status === 'fail').length;
    console.log(`listing-cache-check ${rows.length - failed}/${rows.length}`);
    process.exit(code);
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.name : 'error');
    process.exit(1);
  });
