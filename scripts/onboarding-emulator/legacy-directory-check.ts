/**
 * 旧一覧が退会途中のユーザーを出さないこと。
 * demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx --import ./scripts/onboarding-emulator/register-server-only.mjs scripts/onboarding-emulator/legacy-directory-check.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { join } from 'node:path';
import { EMULATOR, applyIsolatedEnv } from './isolate';

applyIsolatedEnv();

const suffix = Date.now().toString(36);
const PHOTO = 'https://example.com/photo.jpg';

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

async function main(): Promise<number> {
  if (process.env.PROCOM_EMULATOR !== '1' || process.env.FIREBASE_PROJECT_ID !== 'demo-procom-local') {
    console.error('Emulator 隔離が無効です。テストは開始しません。');
    return 1;
  }
  if (process.env.FIREBASE_KEY_PATH) {
    console.error('鍵パスが空ではありません。テストは開始しません。');
    return 1;
  }
  if (process.env.LISTING_DIRECTORY_READY === '1') {
    console.error('旧一覧のテストなのに新方式が有効です。テストは開始しません。');
    return 1;
  }

  const ports = [9099, 8282, 9199, 4401];
  const already = await Promise.all(ports.map((port) => portOpen(port)));
  let emulator: ChildProcess | null = null;
  let db: FirebaseFirestore.Firestore | null = null;
  const created: string[] = [];
  try {
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

  ({ db } = await import('../../app/lib/firebase-admin'));
  const admin = (await import('firebase-admin')).default;
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

  const { readLegacyDirectory, filterLegacySearch } = await import('../../app/lib/listing/legacyDirectory');
  const { readLegacySpotlightSource } = await import('../../app/lib/listing/spotlightSource');
  const { enqueueUserListing } = await import('../../app/lib/listing/firestoreListing');
  const { PUBLIC_USERS_PAGE_SIZE, compareDirectoryOrder, sliceDirectoryPage } = await import('../../app/lib/publicUserDirectory');

  if (!db) throw new Error('Firestore が初期化されていません');
  const firestore = db;

  async function putUser(id: string, data: Record<string, unknown>): Promise<void> {
    created.push(id);
    await firestore.collection('users').doc(id).set(data);
  }

    const shownIds = Array.from({ length: 22 }, (_, index) => `shown${String(index).padStart(2, '0')}${suffix}`);
    for (let index = 0; index < shownIds.length; index += 1) {
      const id = shownIds[index];
      await putUser(id, {
        uid: id,
        createdAt: 2_000_000 - index * 1000,
        profile: {
          name: `Shown${String(index).padStart(2, '0')}`,
          title: 'Public',
          isPublic: true,
          onboardingStatus: 'complete',
          photos: index === 0 ? [PHOTO] : [],
        },
      });
    }

    const legacyId = `legacy${suffix}`;
    const pendingId = `pending${suffix}`;
    const requiredId = `required${suffix}`;
    const privateId = `private${suffix}`;
    const unknownId = `unknown${suffix}`;
    const missingId = `missing${suffix}`;
    await putUser(legacyId, {
      uid: legacyId,
      createdAt: 10_000,
      profile: { name: 'LegacyKeeper', title: 'Public', isPublic: true, photos: [PHOTO] },
    });
    await putUser(pendingId, {
      uid: pendingId,
      createdAt: 3_000_000,
      deletionPending: true,
      profile: {
        name: 'LeaveMe',
        title: 'Public',
        isPublic: true,
        onboardingStatus: 'complete',
        photos: [PHOTO],
      },
    });
    await putUser(requiredId, {
      uid: requiredId,
      createdAt: 2_900_000,
      profile: { name: 'RequiredUser', title: 'Public', isPublic: true, onboardingStatus: 'required', photos: [PHOTO] },
    });
    await putUser(privateId, {
      uid: privateId,
      createdAt: 2_800_000,
      profile: { name: 'PrivateUser', title: 'Public', isPublic: false, onboardingStatus: 'complete', photos: [PHOTO] },
    });
    await putUser(unknownId, {
      uid: unknownId,
      createdAt: 2_700_000,
      profile: { name: 'UnknownUser', title: 'Public', isPublic: true, onboardingStatus: 'later', photos: [PHOTO] },
    });

    const listed = await readLegacyDirectory();
    const ids = new Set(listed.map((user) => user.uid));
    const hidden = [pendingId, requiredId, privateId, unknownId, missingId];
    row(
      '公開とlegacyは表示し、対象外は出さない',
      shownIds.every((id) => ids.has(id)) &&
        ids.has(legacyId) &&
        hidden.every((id) => !ids.has(id)),
      `listed=${listed.length}`
    );

    const ours = listed.filter((user) => created.includes(user.uid));
    const expectedOrder = [...ours].sort(compareDirectoryOrder);
    row(
      '既存の並び順',
      ours.every((user, index) => user.uid === expectedOrder[index]?.uid) && expectedOrder[0]?.uid === shownIds[0],
      expectedOrder[0]?.uid ?? 'none'
    );

    const page1 = sliceDirectoryPage(listed, 1);
    const page2 = sliceDirectoryPage(listed, 2);
    const pageCount = Math.ceil(listed.length / PUBLIC_USERS_PAGE_SIZE);
    const pages = Array.from({ length: pageCount }, (_, index) => sliceDirectoryPage(listed, index + 1));
    const flat = pages.flat();
    row(
      'ページネーション',
      PUBLIC_USERS_PAGE_SIZE === 20 &&
        listed.length === 23 &&
        page1.length === 20 &&
        page2.length === 3 &&
        page1[0]?.uid === shownIds[0] &&
        page2.map((user) => user.uid).join(',') === `${shownIds[20]},${shownIds[21]},${legacyId}` &&
        pages.slice(0, -1).every((page) => page.length === 20) &&
        flat.length === listed.length &&
        flat.every((user, index) => user.uid === listed[index]?.uid) &&
        flat.every((user) => !hidden.includes(user.uid)),
      `page1=${page1.length} page2=${page2.length}`
    );

    const foundShown = filterLegacySearch(listed, 'Shown00');
    const foundLegacy = filterLegacySearch(listed, 'LegacyKeeper');
    const foundPending = filterLegacySearch(listed, 'LeaveMe');
    const foundRequired = filterLegacySearch(listed, 'RequiredUser');
    row(
      '検索',
      foundShown.length === 1 &&
        foundShown[0]?.uid === shownIds[0] &&
        foundLegacy.length === 1 &&
        foundLegacy[0]?.uid === legacyId &&
        foundPending.length === 0 &&
        foundRequired.length === 0,
      `shown=${foundShown.length} pending=${foundPending.length}`
    );

    const spotlight = await readLegacySpotlightSource();
    const spotlightIds = new Set(spotlight.map((user) => user.uid));
    row(
      'Spotlight',
      spotlightIds.has(shownIds[0]) &&
        spotlightIds.has(legacyId) &&
        hidden.every((id) => !spotlightIds.has(id)),
      `source=${spotlight.length}`
    );

    const syncedId = shownIds[1];
    await enqueueUserListing(syncedId);
    await enqueueUserListing(pendingId);
    const syncedProfile = await firestore.collection('publicProfiles').doc(syncedId).get();
    const pendingProfile = await firestore.collection('publicProfiles').doc(pendingId).get();
    row(
      '新方式のpublicProfiles',
      syncedProfile.exists && syncedProfile.get('name') === 'Shown01' && !pendingProfile.exists,
      `shown=${syncedProfile.exists} pending=${pendingProfile.exists}`
    );

    const failed = rows.filter((item) => item.status === 'fail');
    console.log(`${rows.length - failed.length}/${rows.length} passed`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    if (db) {
      for (const uid of created) {
        await db.collection('users').doc(uid).delete().catch(() => undefined);
        await db.collection('publicProfiles').doc(uid).delete().catch(() => undefined);
        await db.collection('listingOutbox').doc(uid).delete().catch(() => undefined);
        await db.collection('listingTombstones').doc(uid).delete().catch(() => undefined);
      }
    }
    stopChild(emulator);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : 'error');
    process.exit(1);
  });
