import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { sealData } from 'iron-session';

const root = path.resolve(process.cwd());
const emuHost = '127.0.0.1:8181';
const appOrigin = 'http://127.0.0.1:3477';
const rpcLog = path.join(root, 'scripts', 'listing-emulator', 'rpc.log');
const preload = path.join(root, 'scripts', 'listing-emulator', 'preload.cjs').replaceAll('\\', '/');
const syncSecret = crypto.randomBytes(24).toString('hex');

type Status = 'PASS' | 'FAIL' | 'BLOCKED';
const results = new Map<string, Status>();
const notes = new Map<string, string>();
const httpStatus: string[] = [];
const children: ChildProcess[] = [];

function mark(name: string, status: Status, note = ''): void {
  const current = results.get(name);
  if (current === 'FAIL' || current === 'BLOCKED') return;
  results.set(name, status);
  if (note) notes.set(name, note);
}

function loadDotEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const matched = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!matched) continue;
    let value = matched[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[matched[1]] = value;
  }
  return out;
}

function isEmulatorSettings(settings: { host?: string; servicePath?: string; port?: number; ssl?: boolean } | undefined, host: string): boolean {
  if (!settings || settings.ssl !== false) return false;
  const endpoint = settings.host || (settings.servicePath && settings.port ? `${settings.servicePath}:${settings.port}` : '');
  return endpoint === host;
}

function killTree(child?: ChildProcess | null): void {
  const pid = child?.pid;
  if (!pid) return;
  spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
}

function runWorker(args: string[], env: NodeJS.ProcessEnv, timeoutMs = 180_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'listing-emulator', 'worker-bundle.cjs'), ...args], {
      cwd: root,
      env,
      shell: false,
    });
    children.push(child);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => killTree(child), timeoutMs);
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function runNode(args: string[], env: NodeJS.ProcessEnv, timeoutMs = 180_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['--yes', 'tsx', ...args], { cwd: root, env, shell: true });
    children.push(child);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      killTree(child);
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function waitForEmulator(child: ChildProcess): Promise<void> {
  let text = '';
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Firestore Emulator が起動しませんでした')), 180_000);
    const onData = (chunk: Buffer) => {
      text += chunk.toString();
      if (text.includes('All emulators ready')) {
        clearTimeout(timer);
        resolve();
      }
      if (text.includes('Fatal error') || text.includes('EADDRINUSE')) {
        clearTimeout(timer);
        reject(new Error('Firestore Emulator の起動に失敗しました'));
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', () => {
      clearTimeout(timer);
      reject(new Error('Firestore Emulator が途中で終了しました'));
    });
  });
}

function userDoc(index: number, prefix: string, createdAt: number) {
  const n = String(index).padStart(2, '0');
  const uid = `${prefix}-${n}`;
  return {
    uid,
    data: {
      createdAt,
      email: `${uid}@example.test`,
      profile: {
        name: `${prefix}Name${n}`,
        title: index === 2 ? 'ダンサー' : '活動者',
        photos: [{ url: `https://example.test/${uid}.jpg` }],
      },
    },
  };
}

async function http(
  urlPath: string,
  init: RequestInit = {}
): Promise<{ status: number; body: string; cache: string }> {
  const response = await fetch(`${appOrigin}${urlPath}`, { ...init, redirect: 'manual' });
  const body = await response.text();
  const cache = response.headers.get('cache-control') ?? '';
  return { status: response.status, body, cache };
}

function uidsIn(html: string, prefix: string): string[] {
  return [...html.matchAll(new RegExp(`/user/(${prefix}-\\d+)`, 'g'))].map((match) => match[1]);
}

function clearRpc(): void {
  fs.writeFileSync(rpcLog, '');
}

function rpcLines(): string[] {
  if (!fs.existsSync(rpcLog)) return [];
  return fs.readFileSync(rpcLog, 'utf8').split(/\r?\n/).filter(Boolean);
}

async function main(): Promise<void> {
  const fileEnv = loadDotEnv(path.join(root, '.env.local'));
  const keyPath = fileEnv.FIREBASE_KEY_PATH;
  const sessionPassword = fileEnv.SESSION_PASSWORD;
  if (!keyPath || !fs.existsSync(path.resolve(keyPath))) {
    mark('Emulator接続', 'BLOCKED', '秘密鍵ファイルを確認できない');
    return finish(null, null);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf8')) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    mark('Emulator接続', 'BLOCKED', '秘密鍵の形式が不正です');
    return finish(null, null);
  }
  const projectId = serviceAccount.project_id;

  fs.writeFileSync(rpcLog, '');
  const emulator = spawn(
    'npx',
    ['--yes', 'firebase-tools', 'emulators:start', '--only', 'firestore', '--project', 'demo-procom-emu', '--config', 'scripts/listing-emulator/firebase.json'],
    { cwd: root, env: { ...process.env, CI: 'true' }, shell: true }
  );
  children.push(emulator);
  console.log('stage\temulator-starting');
  try {
    await waitForEmulator(emulator);
  } catch (err) {
    mark('Emulator接続', 'BLOCKED', err instanceof Error ? err.message : 'emulator start failed');
    return finish(emulator, null);
  }
  console.log(`stage\temulator-ready host=${emuHost}`);

  const nonce = `emu-${crypto.randomBytes(8).toString('hex')}`;
  const restUrl = `http://${emuHost}/v1/projects/${projectId}/databases/(default)/documents/emuProbe?documentId=ready`;
  const restResponse = await fetch(restUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { nonce: { stringValue: nonce } } }),
  });
  if (!restResponse.ok) {
    mark('Emulator接続', 'BLOCKED', `Emulator REST が ${restResponse.status}`);
    return finish(emulator, null);
  }

  process.env.FIRESTORE_EMULATOR_HOST = emuHost;
  const admin = (await import('firebase-admin')).default;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
    }),
  });
  const db = admin.firestore();
  const settings = (db as unknown as { _settings?: { host?: string; ssl?: boolean; projectId?: string; servicePath?: string; port?: number } })._settings;
  if (!isEmulatorSettings(settings, emuHost) || (settings?.projectId && settings.projectId !== projectId)) {
    mark('Emulator接続', 'BLOCKED', 'Admin SDK の接続先を確認できないため中断');
    return finish(emulator, null);
  }
  const probe = await db.collection('emuProbe').doc('ready').get();
  if (probe.data()?.nonce !== nonce) {
    mark('Emulator接続', 'BLOCKED', 'SDK から Emulator の文書を読めないため中断');
    return finish(emulator, null);
  }
  mark('Emulator接続', 'PASS', `${settings?.servicePath ?? settings?.host}:${settings?.port ?? ''} project=${projectId} ssl=false`);
  console.log(`stage\tconnected host=${settings?.host ?? ''} project=${projectId}`);

  const batch = db.batch();
  const uids: string[] = [];
  for (let index = 1; index <= 44; index += 1) {
    const user = userDoc(index, 'emu44', 2_000_000_000_000 - index * 1000);
    uids.push(user.uid);
    batch.set(db.collection('users').doc(user.uid), user.data);
  }
  await batch.commit();
  const seeded = await db.collection('users').select().get();
  const seededIds = seeded.docs.map((doc) => doc.id);
  mark(
    'ダミー44人',
    seeded.size === 44 && seededIds.every((id) => id.startsWith('emu44-')) ? 'PASS' : 'FAIL',
    `count=${seeded.size}`
  );

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: emuHost,
    FIREBASE_KEY_PATH: keyPath,
    FIREBASE_STORAGE_BUCKET: fileEnv.FIREBASE_STORAGE_BUCKET,
    LISTING_BACKFILL_APPROVED: 'yes',
  };
  const preflight = await runNode(['scripts/listing-emulator/preflight.ts'], childEnv);
  const preflightJson = preflight.stdout.trim().split(/\r?\n/).find((line) => line.startsWith('{')) ?? '';
  let preflightOk = false;
  try {
    const parsed = JSON.parse(preflightJson) as { ok?: boolean; userCount?: number; host?: string; foreignIds?: number };
    preflightOk = parsed.ok === true && parsed.userCount === 44 && parsed.host === emuHost && parsed.foreignIds === 0;
    console.log(`stage\tpreflight users=${parsed.userCount} host=${parsed.host}`);
  } catch {
    preflightOk = false;
  }
  if (!preflightOk) {
    mark('移行20・20・4', 'BLOCKED', '移行プロセスの Emulator 接続を確認できない');
    return finish(emulator, null);
  }

  const migrated = await runNode(['scripts/listing-migrate.ts', '--apply'], childEnv, 180_000);
  const migrateText = `${migrated.stdout}\n${migrated.stderr}`;
  const pageSizes = [1, 2, 3].map(async (pageNo) => {
    const snap = await db.collection('directoryPages').doc(String(pageNo)).get();
    const cards = snap.data()?.cards;
    return Array.isArray(cards) ? cards.length : 0;
  });
  const sizes = await Promise.all(pageSizes);
  const migratePass = migrated.code === 0 && sizes.join(',') === '20,20,4' && migrateText.includes('verify ready=true');
  mark('移行20・20・4', migratePass ? 'PASS' : 'FAIL', `exit=${migrated.code} pages=${sizes.join(',')} verify=${migrateText.includes('verify ready=true')}`);
  console.log(`stage\tmigrated pages=${sizes.join(',')}`);
  if (!migratePass) return finish(emulator, null);

  const startNext = (): ChildProcess => {
    const child = spawn(
      'npx',
      ['--yes', 'next', 'dev', '-H', '127.0.0.1', '-p', '3477'],
      {
        cwd: root,
        shell: true,
        env: {
          ...process.env,
          FIRESTORE_EMULATOR_HOST: emuHost,
          FIREBASE_KEY_PATH: keyPath,
          SESSION_PASSWORD: sessionPassword,
          FIREBASE_STORAGE_BUCKET: fileEnv.FIREBASE_STORAGE_BUCKET,
          LISTING_DIRECTORY_READY: '1',
          LISTING_SYNC_SECRET: syncSecret,
          EMU_RPC_LOG: rpcLog,
          NODE_OPTIONS: `--require ${preload}`,
        },
      }
    );
    children.push(child);
    return child;
  };
  let next = startNext();
  console.log('stage\tnext-starting');
  let nextUp = false;
  const started = Date.now();
  while (Date.now() - started < 240_000) {
    try {
      const ping = await http('/api/internal/listing-sync');
      if (ping.status === 401 || ping.status === 200 || ping.status === 503) {
        nextUp = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  if (!nextUp) {
    mark('READY後の/users', 'BLOCKED', 'Next.js が起動しませんでした');
    return finish(emulator, next);
  }

  await db.collection('directoryMeta').doc('health').set({
    lastError: nonce,
    processed: 7,
    lastFinishedAt: '2026-10-12T00:00:00.000Z',
  });
  const authed = await http('/api/internal/listing-sync', {
    headers: { authorization: `Bearer ${syncSecret}` },
  });
  httpStatus.push(`GET /api/internal/listing-sync ${authed.status}`);
  if (!authed.body.includes(nonce)) {
    mark('同期API', 'BLOCKED', 'Next.js が Emulator の監視データを読んでいないため中断');
    mark('READY後の/users', 'BLOCKED', 'Emulator 接続を確認できない');
    return finish(emulator, next);
  }
  console.log('stage\tnext-reads-emulator');

  clearRpc();
  const usersPage = await http('/users');
  const usersReads = rpcLines();
  httpStatus.push(`GET /users ${usersPage.status}`);
  const newestIds = [...new Set(uidsIn(usersPage.body, 'emu44'))];
  mark(
    'READY後の/users',
    usersPage.status === 200 && newestIds.length === 20 && !usersPage.body.includes('href="/users?page=1"') === false
      ? 'PASS'
      : usersPage.status === 200 && newestIds.length === 20
        ? 'PASS'
        : 'FAIL',
    `status=${usersPage.status} links=${newestIds.length}`
  );

  clearRpc();
  const pageReads: string[][] = [];
  const pageIds: string[][] = [];
  for (const pageNo of [1, 2, 3]) {
    clearRpc();
    const page = await http(`/users?page=${pageNo}`);
    httpStatus.push(`GET /users?page=${pageNo} ${page.status}`);
    pageReads.push(rpcLines());
    pageIds.push([...new Set(uidsIn(page.body, 'emu44'))]);
  }
  const allFixed = new Set(pageIds.flat());
  const expectedSizes = [20, 20, 4];
  const fixedPass =
    pageIds.every((ids, index) => ids.length === expectedSizes[index]) && allFixed.size === 44;
  mark('固定ページ全44人', fixedPass ? 'PASS' : 'FAIL', `sizes=${pageIds.map((ids) => ids.length).join(',')} unique=${allFixed.size}`);

  const readSample = [...usersReads, ...pageReads.flat()];
  const userDocReads = readSample.filter((line) => line.includes('path=users/') || line.includes('collection=users'));
  const querySizes = readSample
    .filter((line) => line.startsWith('read query'))
    .map((line) => Number(line.match(/size=(\d+)/)?.[1] ?? '0'));
  const largestQuery = querySizes.length > 0 ? Math.max(...querySizes) : -1;
  const readPass = readSample.some((line) => line.startsWith('read ')) && userDocReads.length === 0 && largestQuery >= 0 && largestQuery <= 20;
  mark(
    '読み取り件数',
    readSample.some((line) => line.startsWith('read ')) ? (readPass ? 'PASS' : 'FAIL') : 'BLOCKED',
    `observed=${readSample.filter((line) => line.startsWith('read ')).length} largestQuery=${largestQuery} usersReads=${userDocReads.length}`
  );

  const target = 'emu44-01';
  let profileStatus = 0;
  if (!sessionPassword || sessionPassword.length < 32) {
    mark('プロフィール同期', 'BLOCKED', 'セッション秘密をテストから使えません');
    mark('SSR HTML', 'BLOCKED', 'プロフィール更新APIを呼べません');
  } else {
    const sealed = await sealData({ uid: target, username: 'emu44Name01', loggedIn: true }, { password: sessionPassword, ttl: 3600 });
    const saved = await http(`/api/user/${target}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `procom_session=${sealed}` },
      body: JSON.stringify({
        skipStoreUrlValidation: true,
        profile: {
          name: 'EmuRenamed01',
          title: '歌手テスト',
          photos: [{ url: 'https://example.test/emu-renamed.jpg', position: 0 }],
        },
      }),
    });
    profileStatus = saved.status;
    httpStatus.push(`POST /api/user/${target} ${saved.status}`);
    const beforeSync = await db.collection('publicProfiles').doc(target).get();
    const synced = await http('/api/internal/listing-sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${syncSecret}` },
    });
    httpStatus.push(`POST /api/internal/listing-sync ${synced.status}`);
    const afterSync = await db.collection('publicProfiles').doc(target).get();
    const cardPage = await db.collection('directoryPages').doc(String(afterSync.data()?.pageNo ?? 1)).get();
    const cards = Array.isArray(cardPage.data()?.cards) ? cardPage.data()?.cards : [];
    const card = cards.find((item: { uid?: string }) => item?.uid === target);
    const profileOk =
      saved.status === 200 &&
      beforeSync.data()?.name === 'EmuRenamed01' &&
      afterSync.data()?.name === 'EmuRenamed01' &&
      afterSync.data()?.title === '歌手テスト' &&
      afterSync.data()?.photoUrl === 'https://example.test/emu-renamed.jpg' &&
      afterSync.data()?.seq === 1 &&
      card?.name === 'EmuRenamed01' &&
      card?.title === '歌手テスト' &&
      card?.photoUrl === 'https://example.test/emu-renamed.jpg';
    mark('プロフィール同期', profileOk ? 'PASS' : 'FAIL', `http=${saved.status} seq=${String(afterSync.data()?.seq)}`);

    let html = await http('/users?page=1');
    httpStatus.push(`GET /users?page=1 after-update ${html.status}`);
    let htmlOk = html.body.includes('EmuRenamed01') && html.body.includes('歌手テスト') && html.body.includes('https://example.test/emu-renamed.jpg');
    if (!htmlOk) {
      killTree(next);
      fs.rmSync(path.join(root, '.next', 'cache'), { recursive: true, force: true });
      const restarted = startNext();
      next = restarted;
      const restartBegan = Date.now();
      let restartedUp = false;
      while (Date.now() - restartBegan < 180_000) {
        try {
          const ping = await http('/api/internal/listing-sync');
          if (ping.status === 401 || ping.status === 200) {
            restartedUp = true;
            break;
          }
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      if (restartedUp) {
        html = await http('/users?page=1');
        httpStatus.push(`GET /users?page=1 after-restart ${html.status}`);
        htmlOk = html.body.includes('EmuRenamed01') && html.body.includes('歌手テスト') && html.body.includes('https://example.test/emu-renamed.jpg');
      }
    }
    mark('SSR HTML', html.status === 200 && htmlOk ? 'PASS' : 'FAIL', htmlOk ? 'fresh server HTML contains the update' : '再起動後の HTML にも更新後の名前・肩書・画像がありません');
  }

  const seqBefore = (await db.collection('publicProfiles').doc(target).get()).data()?.seq;
  const firstReplay = await http('/api/internal/listing-sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${syncSecret}` },
  });
  const secondReplay = await http('/api/internal/listing-sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${syncSecret}` },
  });
  httpStatus.push(`POST sync replay ${firstReplay.status}`);
  httpStatus.push(`POST sync replay2 ${secondReplay.status}`);
  const profiles = await db.collection('publicProfiles').get();
  const seqs = profiles.docs.map((doc) => doc.data().seq);
  const seqUnique = new Set(seqs).size === seqs.length;
  const pageCards = await db.collection('directoryPages').get();
  const listed: string[] = [];
  for (const doc of pageCards.docs) {
    const cards = doc.data().cards;
    if (!Array.isArray(cards)) continue;
    for (const card of cards) if (card?.uid) listed.push(String(card.uid));
  }
  const listedUnique = new Set(listed).size === listed.length;
  mark(
    '同期2回の冪等性',
    firstReplay.status === 200 && secondReplay.status === 200 && seqBefore === 1 && seqUnique && listedUnique
      ? 'PASS'
      : 'FAIL',
    `seqUnique=${seqUnique} cards=${listed.length} unique=${new Set(listed).size}`
  );

  const raceBatch = db.batch();
  const raceUids: string[] = [];
  for (let index = 1; index <= 8; index += 1) {
    const user = userDoc(index, 'emuRace', 2_100_000_000_000 - index * 1000);
    raceUids.push(user.uid);
    raceBatch.set(db.collection('users').doc(user.uid), user.data);
  }
  await raceBatch.commit();
  const bundled = await new Promise<{ code: number; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'listing-emulator', 'bundle-worker.mjs')], {
      cwd: root,
      env: process.env,
      shell: false,
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('exit', (code) => resolve({ code: code ?? 1, stderr }));
  });
  if (bundled.code !== 0) {
    mark('2プロセス同時実行', 'BLOCKED', 'ワーカーの束ねに失敗しました');
    mark('途中停止後の復旧', 'BLOCKED', 'ワーカーの束ねに失敗しました');
    mark('非公開と退会', 'BLOCKED', 'ワーカーの束ねに失敗しました');
  }
  const workerEnv = {
    ...childEnv,
    EMU_RPC_LOG: rpcLog,
    NODE_OPTIONS: `--require ${preload}`,
  };
  const enqueued = bundled.code === 0
    ? await runWorker(['enqueue', ...raceUids], workerEnv)
    : { code: 1, stdout: '', stderr: bundled.stderr };
  const workerArgs = (owner: string) => ['work', owner];
  const [left, right] = await Promise.all([
    runWorker(workerArgs('worker-a'), workerEnv),
    runWorker(workerArgs('worker-b'), workerEnv),
  ]);
  const leftJson = left.stdout.trim().split(/\r?\n/).find((line) => line.startsWith('{')) ?? '';
  const rightJson = right.stdout.trim().split(/\r?\n/).find((line) => line.startsWith('{')) ?? '';
  let concurrentOk = false;
  try {
    const a = JSON.parse(leftJson) as { processed?: number; skippedLock?: boolean };
    const b = JSON.parse(rightJson) as { processed?: number; skippedLock?: boolean };
    const after = await db.collection('publicProfiles').get();
    const afterSeq = after.docs.map((doc) => doc.data().seq);
    const raceProfiles = after.docs.filter((doc) => doc.id.startsWith('emuRace-'));
    concurrentOk =
      enqueued.code === 0 &&
      ((a.skippedLock === true && (b.processed ?? 0) > 0) || (b.skippedLock === true && (a.processed ?? 0) > 0)) &&
      new Set(afterSeq).size === afterSeq.length &&
      raceProfiles.length === 8 &&
      raceProfiles.every((doc) => typeof doc.data().seq === 'number');
    notes.set('2プロセス同時実行', `a=${leftJson} b=${rightJson} race=${raceProfiles.length}`);
  } catch {
    concurrentOk = false;
    notes.set('2プロセス同時実行', `enqueue=${enqueued.code} left=${left.stderr.slice(0, 240)} right=${right.stderr.slice(0, 240)}`);
  }
  mark('2プロセス同時実行', concurrentOk ? 'PASS' : 'FAIL');

  const originalSeq = new Map<string, number>();
  const currentProfiles = await db.collection('publicProfiles').get();
  for (const doc of currentProfiles.docs) {
    if (typeof doc.data().seq === 'number') originalSeq.set(doc.id, doc.data().seq);
  }
  await runWorker(['enqueue', ...uids.slice(0, 20)], workerEnv);
  const crash = spawn(process.execPath, [path.join(root, 'scripts', 'listing-emulator', 'worker-bundle.cjs'), ...workerArgs('worker-crash')], {
    cwd: root,
    env: workerEnv,
  });
  children.push(crash);
  await new Promise((resolve) => setTimeout(resolve, 200));
  killTree(crash);
  const lockSnap = await db.collection('directoryMeta').doc('lock').get();
  if (lockSnap.exists && typeof lockSnap.data()?.untilMs === 'number') {
    await db.collection('directoryMeta').doc('lock').set({ untilMs: Date.now() - 1000 }, { merge: true });
    notes.set('途中停止後の復旧', '強制終了後、残ったロックの期限を過去にして再実行');
  } else {
    notes.set('途中停止後の復旧', '強制終了時にロックは残っていませんでした');
  }
  const recovered = await runWorker(workerArgs('worker-recover'), workerEnv);
  const recoverProfiles = await db.collection('publicProfiles').get();
  const recoverSeq = recoverProfiles.docs.map((doc) => doc.data().seq);
  const seqStable = [...originalSeq.entries()].every(([uid, seq]) => recoverProfiles.docs.find((doc) => doc.id === uid)?.data().seq === seq);
  const recoverCards: string[] = [];
  const recoverPages = await db.collection('directoryPages').get();
  for (const doc of recoverPages.docs) {
    const cards = doc.data().cards;
    if (!Array.isArray(cards)) continue;
    for (const card of cards) if (card?.uid) recoverCards.push(String(card.uid));
  }
  mark(
    '途中停止後の復旧',
    recovered.code === 0 && seqStable && new Set(recoverSeq).size === recoverSeq.length && new Set(recoverCards).size === recoverCards.length
      ? 'PASS'
      : 'FAIL',
    `${notes.get('途中停止後の復旧') ?? ''} cards=${recoverCards.length} unique=${new Set(recoverCards).size}`
  );

  const hidden = 'emu44-44';
  const removed = 'emu44-43';
  const hiddenSeq = (await db.collection('publicProfiles').doc(hidden).get()).data()?.seq;
  const removedSeq = (await db.collection('publicProfiles').doc(removed).get()).data()?.seq;
  await db.collection('users').doc(hidden).update({ 'profile.isPublic': false });
  await db.collection('users').doc(removed).delete();
  const changed = await runWorker(['enqueue', hidden, removed], workerEnv);
  const removalSync = await runWorker(workerArgs('worker-remove'), workerEnv);
  const hiddenProfile = await db.collection('publicProfiles').doc(hidden).get();
  const removedProfile = await db.collection('publicProfiles').doc(removed).get();
  const remainingCards: string[] = [];
  const remainingPages = await db.collection('directoryPages').get();
  for (const doc of remainingPages.docs) {
    const cards = doc.data().cards;
    if (!Array.isArray(cards)) continue;
    for (const card of cards) if (card?.uid) remainingCards.push(String(card.uid));
  }
  const reused = [...(await db.collection('publicProfiles').get()).docs].some((doc) => {
    const seq = doc.data().seq;
    return doc.id !== hidden && doc.id !== removed && (seq === hiddenSeq || seq === removedSeq);
  });
  mark(
    '非公開と退会',
    changed.code === 0 &&
      removalSync.code === 0 &&
      !hiddenProfile.exists &&
      !removedProfile.exists &&
      !remainingCards.includes(hidden) &&
      !remainingCards.includes(removed) &&
      !reused
      ? 'PASS'
      : 'FAIL',
    `hiddenExists=${hiddenProfile.exists} removedExists=${removedProfile.exists} reused=${reused}`
  );

  const search = await http('/api/users?q=EmuRenamed01');
  const shortSearch = await http('/api/users?q=a');
  const category = await http(`/api/category-users?category=${encodeURIComponent('ダンサー')}`);
  const singer = await http(`/api/category-users?category=${encodeURIComponent('歌手')}`);
  const top = await http('/top');
  httpStatus.push(`GET /api/users?q=EmuRenamed01 ${search.status}`);
  httpStatus.push(`GET /api/users?q=a ${shortSearch.status}`);
  httpStatus.push(`GET /api/category-users ダンサー ${category.status}`);
  httpStatus.push(`GET /api/category-users 歌手 ${singer.status}`);
  httpStatus.push(`GET /top ${top.status}`);
  let searchHit = false;
  let categoryHit = false;
  let singerHit = false;
  try {
    searchHit = JSON.parse(search.body).users?.some((user: { uid?: string }) => user.uid === target);
    categoryHit = JSON.parse(category.body).users?.some((user: { uid?: string }) => user.uid === 'emu44-02');
    singerHit = JSON.parse(singer.body).users?.some((user: { uid?: string }) => user.uid === target);
  } catch {
    searchHit = false;
  }
  const topHit = top.body.includes('emu44-') || top.body.includes('example.test/emu');
  mark(
    '検索・カテゴリ・トップ',
    search.status === 200 && searchHit && shortSearch.status === 400 && category.status === 200 && categoryHit && singer.status === 200 && singerHit && top.status === 200 && topHit
      ? 'PASS'
      : 'FAIL',
    `search=${search.status} short=${shortSearch.status} category=${category.status} singer=${singer.status} top=${top.status} topHit=${topHit}`
  );

  const noAuth = await http('/api/internal/listing-sync', { method: 'POST' });
  const badAuth = await http('/api/internal/listing-sync', {
    method: 'POST',
    headers: { authorization: 'Bearer wrong-token' },
  });
  const health = await http('/api/internal/listing-sync', {
    headers: { authorization: `Bearer ${syncSecret}` },
  });
  httpStatus.push(`POST sync no-auth ${noAuth.status}`);
  httpStatus.push(`POST sync bad-auth ${badAuth.status}`);
  httpStatus.push(`GET sync health ${health.status} cache=${health.cache}`);
  let healthKeysOk = false;
  let leaked = true;
  try {
    const parsed = JSON.parse(health.body) as Record<string, unknown>;
    const keys = Object.keys(parsed).sort().join(',');
    healthKeysOk = keys === 'lastError,lastFinishedAt,lastOkAt,processed';
    leaked = /private_key|BEGIN |client_email|SESSION_PASSWORD|Bearer /i.test(health.body);
  } catch {
    healthKeysOk = false;
  }
  mark(
    '同期API',
    noAuth.status === 401 && badAuth.status === 401 && health.status === 200 && health.cache.includes('private') && healthKeysOk && !leaked
      ? 'PASS'
      : 'FAIL',
    `noAuth=${noAuth.status} badAuth=${badAuth.status} health=${health.status} keysOk=${healthKeysOk} leaked=${leaked} profileHttp=${profileStatus}`
  );

  const finalUsers = await db.collection('users').select().get();
  const foreign = finalUsers.docs.filter((doc) => !doc.id.startsWith('emu'));
  mark('本番Firestoreへの書き込み0件', isEmulatorSettings(settings, emuHost) && foreign.length === 0 ? 'PASS' : 'FAIL', `endpoint=${settings?.servicePath}:${settings?.port} foreignUsers=${foreign.length}`);

  return finish(emulator, next);
}

function finish(emulator: ChildProcess | null, next: ChildProcess | null): void {
  killTree(next);
  killTree(emulator);
  for (const child of children) killTree(child);
  fs.rmSync(path.join(root, 'scripts', 'listing-emulator', 'worker-bundle.cjs'), { force: true });
  const order = [
    'Emulator接続',
    'ダミー44人',
    '移行20・20・4',
    'READY後の/users',
    '固定ページ全44人',
    'プロフィール同期',
    'SSR HTML',
    '同期2回の冪等性',
    '2プロセス同時実行',
    '途中停止後の復旧',
    '非公開と退会',
    '検索・カテゴリ・トップ',
    '読み取り件数',
    '同期API',
    '本番Firestoreへの書き込み0件',
  ];
  for (const name of order) {
    console.log(`${results.get(name) ?? 'BLOCKED'}\t${name}\t${notes.get(name) ?? ''}`);
  }
  console.log('http');
  for (const line of httpStatus) console.log(line);
  const failed = [...results.values()].some((status) => status !== 'PASS') || results.size < order.length;
  process.exit(failed ? 1 : 0);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'integration failed';
  console.error(message);
  mark('Emulator接続', 'BLOCKED', message);
  finish(null, null);
});
