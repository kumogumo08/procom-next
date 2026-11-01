/**
 * プロフィール画像の差し替え、猶予削除、Spotlight キャッシュ。
 * demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx --import ./scripts/onboarding-emulator/register-server-only.mjs scripts/onboarding-emulator/photo-retention-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import {
  SPOTLIGHT_SOURCE_REVALIDATE_SECONDS,
  mulberry32,
  selectSpotlight,
  toSpotlightCandidate,
} from '../../app/lib/listing/spotlight';
import {
  isSafePhotoObject,
  listingPhotoChanged,
  ownedReplacementPhotoPath,
} from '../../app/lib/ownedPhotoPath';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const ORIGIN = `http://127.0.0.1:${EMULATOR.nextPort}`;
const PASSWORD = 'Testpass1';
const ROOT = join(import.meta.dirname, '../..');
const suffix = Date.now().toString(36);
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);
const PHOTO = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
const REVALIDATE_LOG = 'listing-photo-revalidate';

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

function pathFromUrl(url: string): string {
  const parsed = new URL(url);
  return decodeURIComponent(parsed.pathname.split('/o/')[1] ?? '');
}

function fileNameOf(url: string): string {
  const path = pathFromUrl(url);
  return path.split('/').pop() ?? '';
}

function checkPure(): void {
  const upload = readFileSync(join(ROOT, 'app/api/uploadPhotos/route.ts'), 'utf8');
  const candidate = toSpotlightCandidate({
    uid: 'spot',
    name: 'Spot',
    title: 'Public',
    photoUrl: 'https://cdn.example/a.jpg',
    createdAtMs: 1,
    contentUpdatedAtMs: null,
    isPublic: true,
  });
  const picked = candidate ? selectSpotlight([candidate], 1_700_000_000_000, mulberry32(2)) : { users: [] };
  row(
    '13. Spotlightの抽選',
    SPOTLIGHT_SOURCE_REVALIDATE_SECONDS === 3600 &&
      picked.users.length === 1 &&
      picked.users[0]?.photoUrl === 'https://cdn.example/a.jpg',
    `ttl=${SPOTLIGHT_SOURCE_REVALIDATE_SECONDS} picked=${picked.users.length}`
  );
  row(
    '先頭URLだけを比較',
    listingPhotoChanged([{ url: ' https://a ' }], [{ url: 'https://a', position: 10 }]) === false &&
      listingPhotoChanged([{ url: 'https://a' }, { url: 'https://b' }], [{ url: 'https://a' }, { url: 'https://c' }]) ===
        false &&
      listingPhotoChanged([{ url: 'https://a' }], [{ url: 'https://b' }]) === true &&
      ownedReplacementPhotoPath('https://evil.example/v0/b/bucket/o/photos%2Fuid%2Fa.jpg?alt=media', 'uid', 'bucket') ===
        null &&
      isSafePhotoObject('uid', 'photos/other/a.jpg') === false &&
      isSafePhotoObject('uid', 'photos/uid/a.jpg') === true &&
      !upload.includes('getFiles('),
    '旧URLの自己申告は使わない。アップロード前の全削除は無い'
  );
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
  checkPure();

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
  const logs: string[] = [];

  async function exists(path: string): Promise<boolean> {
    const [found] = await bucket.file(path).exists();
    return found;
  }

  async function namesOf(uid: string): Promise<string[]> {
    const [files] = await bucket.getFiles({ prefix: `photos/${uid}/` });
    return files.map((file) => file.name);
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

  function mark(): number {
    return logs.length;
  }

  async function saw(from: number, needle: string): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < 2000) {
      if (logs.slice(from).some((line) => line.includes(needle))) return true;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return logs.slice(from).some((line) => line.includes(needle));
  }

  async function quiet(from: number): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return !logs.slice(from).some((line) => line.includes(REVALIDATE_LOG));
  }

  async function saveProfile(uid: string, jar: CookieJar, profile: Record<string, unknown>) {
    return request(`/api/user/${uid}`, jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
  }

  async function upload(jar: CookieJar, images: string[]) {
    return request('/api/uploadPhotos', jar, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base64Images: images }),
    });
  }

  function urlsFrom(text: string): string[] {
    const parsed = JSON.parse(text) as { urls?: unknown };
    return Array.isArray(parsed.urls) ? parsed.urls.filter((url): url is string => typeof url === 'string') : [];
  }

  async function profilePhotos(uid: string): Promise<string[]> {
    const snap = await db.collection('users').doc(uid).get();
    const photos = snap.get('profile.photos');
    if (!Array.isArray(photos)) return [];
    return photos.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
        return (item as { url: string }).url;
      }
      return '';
    });
  }

  async function sweep(): Promise<{ status: number; deleted: number | null }> {
    const res = await request('/api/internal/listing-sync', new Map(), {
      method: 'POST',
      headers: { authorization: 'Bearer local-emulator-listing-sync' },
    });
    let deleted: number | null = null;
    try {
      const parsed = JSON.parse(res.text) as { photoGc?: { deleted?: number } };
      deleted = typeof parsed.photoGc?.deleted === 'number' ? parsed.photoGc.deleted : null;
    } catch {
      deleted = null;
    }
    return { status: res.status, deleted };
  }

  try {
    if (await portOpen(EMULATOR.nextPort)) {
      console.error('127.0.0.1:3100 が使用中です。テストは開始しません。');
      return 1;
    }

    next = spawn('npx', ['next', 'dev', '-H', '127.0.0.1', '-p', String(EMULATOR.nextPort)], {
      cwd: ROOT,
      env: { ...process.env, LISTING_DIRECTORY_READY: '1' },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const keepLog = (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        if (!line || /PRIVATE|AIza|SESSION_PASSWORD|BEGIN |Bearer /.test(line)) continue;
        logs.push(line);
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
    const oldPath = `photos/${owner.uid}/old-${suffix}.jpg`;
    const otherPath = `photos/${other.uid}/secret.jpg`;
    await bucket.file(oldPath).save(jpeg, { contentType: 'image/jpeg', resumable: false });
    await bucket.file(otherPath).save(jpeg, { contentType: 'image/jpeg', resumable: false });
    const oldUrl = downloadUrl(bucketName, oldPath);
    await db.collection('users').doc(owner.uid).update({
      'profile.photos': [{ url: oldUrl, position: 50 }],
    });
    const jar = await login(owner.email);

    const broken = await upload(jar, ['not-an-image']);
    row(
      '2. アップロード失敗でも旧画像が残る',
      broken.status === 400 && (await exists(oldPath)) && (await exists(otherPath)),
      `HTTP ${broken.status}`
    );

    const uploaded = await upload(jar, [PHOTO]);
    const uploadedUrls = uploaded.status === 200 ? urlsFrom(uploaded.text) : [];
    const uploadedPath = uploadedUrls[0] ? pathFromUrl(uploadedUrls[0]) : '';
    const stillOld = (await profilePhotos(owner.uid))[0] === oldUrl;
    row(
      '1. 新しい画像アップロード成功',
      uploaded.status === 200 &&
        uploadedPath.startsWith(`photos/${owner.uid}/`) &&
        (await exists(uploadedPath)) &&
        (await exists(oldPath)) &&
        stillOld,
      `HTTP ${uploaded.status} saved=${stillOld}`
    );

    const from = mark();
    const unchanged = await saveProfile(owner.uid, jar, {
      name: 'owner',
      bio: '自己紹介だけ変更',
      photos: [{ url: oldUrl, position: 20 }],
    });
    const noInvalidate = await quiet(from);
    row(
      '5. 画像未変更では無効化しない',
      unchanged.status === 200 && noInvalidate && (await profilePhotos(owner.uid))[0] === oldUrl,
      `HTTP ${unchanged.status} log=${noInvalidate}`
    );

    const rejected = await saveProfile(owner.uid, jar, {
      name: 'owner',
      photos: [PHOTO],
      apps: [{ title: '' }],
    });
    const rejectedPhotos = await profilePhotos(owner.uid);
    row(
      '3. Firestore保存失敗でも旧画像が残る',
      rejected.status === 400 && rejectedPhotos[0] === oldUrl && (await exists(oldPath)) && (await exists(otherPath)),
      `HTTP ${rejected.status}`
    );

    const changedFrom = mark();
    const changed = await saveProfile(owner.uid, jar, {
      name: 'owner',
      photos: [{ url: uploadedUrls[0], position: 50 }],
    });
    const didInvalidate = await saw(changedFrom, REVALIDATE_LOG);
    const userPhotos = await profilePhotos(owner.uid);
    const listed = await db.collection('publicProfiles').doc(owner.uid).get();
    const listedUrl = listed.get('photoUrl');
    row(
      '4. 画像変更時にキャッシュ無効化',
      changed.status === 200 && didInvalidate,
      `HTTP ${changed.status} log=${didInvalidate}`
    );
    row(
      '6. usersとpublicProfilesのURLが一致',
      userPhotos[0] === uploadedUrls[0] && listedUrl === uploadedUrls[0],
      `listed=${listedUrl === uploadedUrls[0]}`
    );

    const during = await sweep();
    row(
      '7. 猶予期間内は旧画像を取得できる',
      during.status === 200 && (await exists(oldPath)) && (await exists(uploadedPath)),
      `HTTP ${during.status} old=${await exists(oldPath)}`
    );

    const top = await fetch(`${ORIGIN}/top`, { redirect: 'manual' });
    const topHtml = await top.text();
    const freshName = fileNameOf(uploadedUrls[0] ?? '');
    row(
      '14. TOPに新しいURLが反映される',
      top.status === 200 && freshName.length > 0 && topHtml.includes(freshName) && !topHtml.includes(`old-${suffix}`),
      `HTTP ${top.status} fresh=${topHtml.includes(freshName)}`
    );

    const secondUpload = await upload(jar, [PHOTO]);
    const secondUrl = secondUpload.status === 200 ? urlsFrom(secondUpload.text)[0] : '';
    const secondFrom = mark();
    const secondSaved = await saveProfile(owner.uid, jar, {
      name: 'owner',
      photos: [
        { url: uploadedUrls[0], position: 50 },
        { url: secondUrl, position: 40 },
      ],
    });
    const secondQuiet = await quiet(secondFrom);
    row(
      '2枚目だけ追加しても先頭は無効化しない',
      secondSaved.status === 200 && secondQuiet && (await profilePhotos(owner.uid))[0] === uploadedUrls[0],
      `HTTP ${secondSaved.status} log=${secondQuiet}`
    );

    const extra: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const more = await upload(jar, [PHOTO]);
      const url = more.status === 200 ? urlsFrom(more.text)[0] : '';
      if (url) extra.push(url);
    }
    const five = [uploadedUrls[0], secondUrl, ...extra];
    const fiveSaved = await saveProfile(owner.uid, jar, {
      name: 'owner',
      photos: five.map((url, index) => ({ url, position: 10 * index })),
    });
    const fiveNames = await namesOf(owner.uid);
    const reordered = [five[4], five[3], five[2], five[1], five[0]].filter((url): url is string => Boolean(url));
    const reorderFrom = mark();
    const reorderedSaved = await saveProfile(owner.uid, jar, {
      name: 'owner',
      photos: reordered.map((url) => ({ url, position: 50 })),
    });
    const reorderInvalidated = await saw(reorderFrom, REVALIDATE_LOG);
    const afterReorder = await profilePhotos(owner.uid);
    const emptySaved = await saveProfile(owner.uid, jar, { name: 'owner', photos: [] });
    const afterEmpty = await profilePhotos(owner.uid);
    const namesAfterEmpty = await namesOf(owner.uid);
    row(
      '11. 5枚の保存・並び替え・空送信',
      five.length === 5 &&
        fiveSaved.status === 200 &&
        five.every((url) => fiveNames.includes(pathFromUrl(url))) &&
        reorderedSaved.status === 200 &&
        reorderInvalidated &&
        afterReorder[0] === reordered[0] &&
        afterReorder.length === 5 &&
        emptySaved.status === 200 &&
        afterEmpty.length === 5 &&
        namesAfterEmpty.length >= 5,
      `HTTP ${fiveSaved.status}/${reorderedSaved.status}/${emptySaved.status} count=${afterEmpty.length}`
    );

    const dropped = await saveProfile(owner.uid, jar, {
      name: 'owner',
      photos: [{ url: reordered[0], position: 50 }],
    });
    const droppedNames = await namesOf(owner.uid);
    const restoredFrom = mark();
    const restored = await saveProfile(owner.uid, jar, {
      name: 'owner',
      photos: [{ url: uploadedUrls[0], position: 50 }],
    });
    const restoreInvalidated = await saw(restoredFrom, REVALIDATE_LOG);
    const again = await upload(jar, [PHOTO]);
    const againUrl = again.status === 200 ? urlsFrom(again.text)[0] : '';
    const replacedAgain = againUrl
      ? await saveProfile(owner.uid, jar, { name: 'owner', photos: [{ url: againUrl, position: 50 }] })
      : { status: 0, text: '' };
    const [parallelA, parallelB] = await Promise.all([upload(jar, [PHOTO]), upload(jar, [PHOTO])]);
    const parallelUrls = [parallelA, parallelB].flatMap((res) => (res.status === 200 ? urlsFrom(res.text) : []));
    const parallelNames = await namesOf(owner.uid);
    row(
      'キャンセル・再保存・同時アップロード',
      dropped.status === 200 &&
        droppedNames.includes(pathFromUrl(reordered[1] ?? '')) &&
        restored.status === 200 &&
        restoreInvalidated &&
        (await profilePhotos(owner.uid))[0] === againUrl &&
        replacedAgain.status === 200 &&
        parallelUrls.length === 2 &&
        parallelNames.includes(pathFromUrl(parallelUrls[0] ?? '')) &&
        parallelNames.includes(pathFromUrl(parallelUrls[1] ?? '')) &&
        (await profilePhotos(owner.uid))[0] === againUrl,
      `parallel=${parallelA.status}/${parallelB.status}`
    );

    const currentUrl = (await profilePhotos(owner.uid))[0] ?? '';
    const currentPath = currentUrl ? pathFromUrl(currentUrl) : '';
    const gc = await db.collection('photoGc').where('uid', '==', owner.uid).get();
    const batch = db.batch();
    for (const doc of gc.docs) batch.update(doc.ref, { deleteAfterMs: 1 });
    const forged = db.collection('photoGc').doc(`forged-${suffix}`);
    batch.set(forged, { uid: owner.uid, objectPath: otherPath, deleteAfterMs: 1 });
    await batch.commit();
    let forgedGone = false;
    let oldGone = false;
    let sweeps = 0;
    while (sweeps < 8 && (!forgedGone || !oldGone)) {
      await sweep();
      sweeps += 1;
      forgedGone = !(await forged.get()).exists;
      oldGone = !(await exists(oldPath));
    }
    const currentRemains = currentPath ? await exists(currentPath) : false;
    const otherRemains = await exists(otherPath);
    row(
      '8. 猶予後は未参照画像だけ削除',
      oldGone && currentRemains,
      `sweeps=${sweeps} old=${oldGone} current=${currentRemains}`
    );
    row(
      '9. 参照中の画像は削除しない',
      currentRemains && (await profilePhotos(owner.uid))[0] === currentUrl,
      `path=${currentRemains}`
    );
    row(
      '10. 他人の画像は削除できない',
      otherRemains && forgedGone,
      `other=${otherRemains} forged=${forgedGone}`
    );

    const otherJar = await login(other.email);
    const staleUpload = await upload(otherJar, [PHOTO]);
    const staleUrl = staleUpload.status === 200 ? urlsFrom(staleUpload.text)[0] : '';
    const stalePath = staleUrl ? pathFromUrl(staleUrl) : '';
    const staleGc = stalePath ? await db.collection('photoGc').where('uid', '==', other.uid).get() : null;
    if (staleGc) {
      await Promise.all(
        staleGc.docs
          .filter((doc) => doc.get('objectPath') === stalePath)
          .map((doc) => doc.ref.update({ deleteAfterMs: 1 }))
      );
    }
    let staleGone = false;
    for (let i = 0; stalePath && i < 8 && !staleGone; i += 1) {
      await sweep();
      staleGone = !(await exists(stalePath));
    }
    const staleSave = staleUrl
      ? await saveProfile(other.uid, otherJar, { name: 'other', photos: [{ url: staleUrl, position: 50 }] })
      : { status: 0, text: '' };
    const otherPhotos = await profilePhotos(other.uid);
    row(
      '未保存のまま期限後に消えたURLは保存しない',
      staleUpload.status === 200 &&
        staleGone &&
        staleSave.status === 400 &&
        !otherPhotos.includes(staleUrl) &&
        (await exists(currentPath)),
      `HTTP ${staleSave.status} gone=${staleGone}`
    );

    const heldPath = `photos/${other.uid}/listed-${suffix}.jpg`;
    const livePath = `photos/${other.uid}/live-${suffix}.jpg`;
    await bucket.file(heldPath).save(jpeg, { contentType: 'image/jpeg', resumable: false });
    await bucket.file(livePath).save(jpeg, { contentType: 'image/jpeg', resumable: false });
    const heldUrl = downloadUrl(bucketName, heldPath);
    const liveUrl = downloadUrl(bucketName, livePath);
    await db.collection('users').doc(other.uid).update({
      'profile.photos': [{ url: liveUrl, position: 50 }],
    });
    await db.collection('publicProfiles').doc(other.uid).set({ photoUrl: heldUrl, name: 'other' });
    const listedGc = db.collection('photoGc').doc(`listed-${suffix}`);
    const liveGc = db.collection('photoGc').doc(`live-${suffix}`);
    await listedGc.set({ uid: other.uid, objectPath: heldPath, deleteAfterMs: 1 });
    await liveGc.set({ uid: other.uid, objectPath: livePath, deleteAfterMs: 1 });
    let deferred = 0;
    for (let i = 0; i < 8; i += 1) {
      await sweep();
      const at = (await listedGc.get()).get('deleteAfterMs');
      if ((await exists(heldPath)) && (await exists(livePath)) && typeof at === 'number' && at > Date.now()) {
        deferred = at;
        break;
      }
      if (!(await exists(heldPath)) || !(await exists(livePath))) break;
      await listedGc.set({ uid: other.uid, objectPath: heldPath, deleteAfterMs: 1 }, { merge: true });
    }
    await db.collection('publicProfiles').doc(other.uid).set({ photoUrl: liveUrl, name: 'other' });
    await listedGc.update({ deleteAfterMs: 1 });
    for (let i = 0; i < 8 && (await exists(heldPath)); i += 1) {
      await sweep();
    }
    row(
      '一覧だけが参照する画像は残し、外れた後に削除する',
      deferred > Date.now() &&
        !(await exists(heldPath)) &&
        (await exists(livePath)) &&
        (await exists(otherPath)),
      `deferred=${deferred > Date.now()}`
    );

    const { deleteOwnedStoragePrefix } = await import('../../app/lib/accountDeletion');
    await deleteOwnedStoragePrefix(owner.uid, 'photos');
    const ownerLeft = await namesOf(owner.uid);
    row(
      '12. 退会時の画像削除',
      ownerLeft.length === 0 && (await exists(otherPath)),
      `owner=${ownerLeft.length} other=${await exists(otherPath)}`
    );

    const failed = rows.filter((item) => item.status === 'fail');
    console.log(`photo-retention-check ${rows.length - failed.length}/${rows.length}`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    stopChild(next);
    for (const uid of created) {
      await admin.auth().deleteUser(uid).catch(() => undefined);
      await db.collection('users').doc(uid).delete().catch(() => undefined);
      await db.collection('publicProfiles').doc(uid).delete().catch(() => undefined);
      const gc = await db.collection('photoGc').where('uid', '==', uid).get().catch(() => null);
      if (gc) await Promise.all(gc.docs.map((doc) => doc.ref.delete().catch(() => undefined)));
      const [files] = await bucket.getFiles({ prefix: `photos/${uid}/` }).catch(() => [[]] as const);
      await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
    }
    await db.collection('photoGc').doc(`forged-${suffix}`).delete().catch(() => undefined);
    stopChild(emulator);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'photo-retention-check failed');
    process.exit(1);
  });
