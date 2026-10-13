import { db } from '@/lib/firebase-admin';
import {
  enqueueUserListing,
  getFixedPage,
  getNewestListed,
  runListingWorker,
} from '@/lib/listing/firestoreListing';

type Hooks = {
  onDirectoryPageGetWait: null | (() => Promise<void>);
  failDirectoryPageWrite: boolean;
};

type IsolatedDb = {
  __isolated?: boolean;
  __hooks: Hooks;
  __stats: { writes: number; collections: Set<string> };
  collection: (name: string) => {
    doc: (id: string) => {
      get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      set: (data: Record<string, unknown>) => Promise<void>;
    };
    get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> | undefined }> }>;
  };
};

const isolated = db as unknown as IsolatedDb;
const UID = 'isolated-listing-user';
const results = new Map<string, 'PASS' | 'FAIL' | 'BLOCKED'>();

function mark(name: string, ok: boolean): void {
  const current = results.get(name);
  if (current === 'FAIL' || current === 'BLOCKED') return;
  results.set(name, ok ? 'PASS' : 'FAIL');
}

function userData(name: string, title: string, photoUrl: string) {
  return {
    createdAt: 1_700_000_000_000,
    profile: {
      name,
      title,
      photos: [{ url: photoUrl }],
    },
  };
}

async function readUser(): Promise<Record<string, unknown> | undefined> {
  const snap = await isolated.collection('users').doc(UID).get();
  return snap.data();
}

async function readProfile(): Promise<Record<string, unknown> | undefined> {
  const snap = await isolated.collection('publicProfiles').doc(UID).get();
  return snap.data();
}

async function readOutbox(): Promise<Record<string, unknown> | undefined> {
  const snap = await isolated.collection('listingOutbox').doc(UID).get();
  return snap.exists ? snap.data() : undefined;
}

async function cardsForUser(): Promise<Array<{ pageNo: number; card: Record<string, unknown> }>> {
  const snap = await isolated.collection('directoryPages').get();
  const found: Array<{ pageNo: number; card: Record<string, unknown> }> = [];
  for (const doc of snap.docs) {
    const cards = doc.data()?.cards;
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      if (card && typeof card === 'object' && (card as { uid?: unknown }).uid === UID) {
        found.push({ pageNo: Number(doc.id), card: card as Record<string, unknown> });
      }
    }
  }
  return found;
}

async function publish(name: string, title: string, photoUrl: string): Promise<void> {
  await isolated.collection('users').doc(UID).set(userData(name, title, photoUrl));
  await enqueueUserListing(UID);
}

function profileMatches(profile: Record<string, unknown> | undefined, name: string, title: string, photoUrl: string): boolean {
  return profile?.name === name && profile?.title === title && profile?.photoUrl === photoUrl;
}

async function assertChange(label: '名前変更' | '肩書変更' | '写真変更', name: string, title: string, photoUrl: string, seq: number, pageNo: number): Promise<void> {
  const beforeSeq = seq;
  await publish(name, title, photoUrl);
  const user = await readUser();
  const profile = await readProfile();
  const outbox = await readOutbox();
  const userProfile = user?.profile as { name?: string; title?: string; photos?: Array<{ url?: string }> } | undefined;
  const userOk =
    userProfile?.name === name &&
    userProfile?.title === title &&
    userProfile?.photos?.[0]?.url === photoUrl;
  const outboxOk = outbox?.op === 'upsert' && outbox?.uid === UID && typeof outbox.revision === 'number';
  const seqHeld = profile?.seq === beforeSeq && profile?.pageNo === pageNo;
  mark(label, userOk && profileMatches(profile, name, title, photoUrl) && outboxOk && seqHeld);
  mark('seq維持', seqHeld);
  if (!userOk || !profileMatches(profile, name, title, photoUrl) || !outboxOk) {
    mark('固定ページへの反映', false);
    mark('新着一覧への反映', false);
  }

  await runListingWorker(`worker-${label}`);
  const cards = await cardsForUser();
  const newest = await getNewestListed(20);
  const fixed = await getFixedPage(pageNo);
  const card = cards[0]?.card;
  const newestCard = newest.find((item) => item.uid === UID);
  const fixedCard = fixed.find((item) => item.uid === UID);
  const reflected =
    cards.length === 1 &&
    card?.name === name &&
    card?.title === title &&
    card?.photoUrl === photoUrl &&
    fixedCard?.name === name &&
    fixedCard?.title === title &&
    fixedCard?.photoUrl === photoUrl;
  const newestOk =
    newestCard?.name === name && newestCard?.title === title && newestCard?.photoUrl === photoUrl;
  const sameListing =
    newestCard?.name === fixedCard?.name &&
    newestCard?.title === fixedCard?.title &&
    newestCard?.photoUrl === fixedCard?.photoUrl;
  const after = await readProfile();
  const outboxDone = (await readOutbox()) == null;
  mark(label, userOk && profileMatches(after, name, title, photoUrl) && reflected && newestOk && sameListing && outboxDone);
  mark('固定ページへの反映', reflected && sameListing);
  mark('新着一覧への反映', newestOk && sameListing);
  mark('seq維持', after?.seq === beforeSeq && after?.pageNo === pageNo);
  mark('重複登録防止', cards.length === 1 && newest.filter((item) => item.uid === UID).length === 1);
}

async function main(): Promise<void> {
  const remote = (globalThis as { __procomListingIsolation?: { remoteAttempts: string[]; redirected: string[] } })
    .__procomListingIsolation;
  if (!isolated.__isolated || !remote) {
    results.set('本番Firestoreへの書き込み0件', 'BLOCKED');
    console.log('分離を確認できないため、書き込みテストは実施しません。');
    printResults();
    process.exit(2);
  }
  results.set('本番Firestoreへの書き込み0件', remote.remoteAttempts.length === 0 ? 'PASS' : 'FAIL');
  if (remote.remoteAttempts.length > 0) {
    console.log('リモート接続を検知したため中止しました。');
    printResults();
    process.exit(2);
  }

  await publish('初期名', '初期肩書', 'https://example.test/initial.jpg');
  const firstOutbox = await readOutbox();
  if (firstOutbox?.op !== 'upsert') throw new Error('初期登録の outbox がありません');
  await runListingWorker('worker-initial');
  const initial = await readProfile();
  const seq = initial?.seq;
  const pageNo = initial?.pageNo;
  if (typeof seq !== 'number' || typeof pageNo !== 'number') throw new Error('初期同期で seq が付きませんでした');
  mark('seq維持', (await cardsForUser()).length === 1 && (await readOutbox()) == null);
  mark('重複登録防止', (await cardsForUser()).length === 1);

  await assertChange('名前変更', '変更名', '初期肩書', 'https://example.test/initial.jpg', seq, pageNo);
  await assertChange('肩書変更', '変更名', '変更肩書', 'https://example.test/initial.jpg', seq, pageNo);
  await assertChange('写真変更', '変更名', '変更肩書', 'https://example.test/changed.jpg', seq, pageNo);

  const seqBeforeReplay = (await readProfile())?.seq;
  const pageBeforeReplay = (await readProfile())?.pageNo;
  const replay = await runListingWorker('worker-replay');
  const afterReplay = await readProfile();
  const replayCards = await cardsForUser();
  mark(
    '同期処理の冪等性',
    replay.processed === 0 &&
      !replay.skippedLock &&
      afterReplay?.seq === seqBeforeReplay &&
      afterReplay?.pageNo === pageBeforeReplay &&
      replayCards.length === 1 &&
      (await readOutbox()) == null
  );

  const sameRevision = afterReplay?.revision;
  await isolated.collection('listingOutbox').doc(UID).set({
    uid: UID,
    revision: sameRevision,
    op: 'upsert',
    pageNo: pageBeforeReplay,
  });
  await runListingWorker('worker-duplicate-outbox');
  const afterDuplicate = await cardsForUser();
  mark(
    '重複登録防止',
    afterDuplicate.length === 1 && (await readProfile())?.seq === seq
  );
  mark(
    '同期処理の冪等性',
    afterDuplicate.length === 1 &&
      (await readProfile())?.seq === seqBeforeReplay &&
      (await readProfile())?.pageNo === pageBeforeReplay &&
      (await readOutbox()) == null
  );

  await publish('失敗前', '変更肩書', 'https://example.test/changed.jpg');
  isolated.__hooks.failDirectoryPageWrite = true;
  await runListingWorker('worker-fail');
  const duringFailure = await cardsForUser();
  const failedOutbox = await readOutbox();
  const failedCardKept =
    duringFailure.length === 1 && duringFailure[0]?.card.name === '変更名';
  const failureRecorded = typeof failedOutbox?.attempts === 'number' && failedOutbox.attempts >= 1;
  await runListingWorker('worker-recover');
  const recovered = await cardsForUser();
  const recoveredProfile = await readProfile();
  mark(
    '途中失敗後の復旧',
    failedCardKept &&
      failureRecorded &&
      recovered.length === 1 &&
      recovered[0]?.card.name === '失敗前' &&
      recoveredProfile?.seq === seq &&
      (await readOutbox()) == null
  );
  mark('seq維持', recoveredProfile?.seq === seq && recoveredProfile?.pageNo === pageNo);
  mark('重複登録防止', recovered.length === 1);

  await publish('途中名', '変更肩書', 'https://example.test/changed.jpg');
  let release = () => {};
  const entered = new Promise<void>((resolve) => {
    isolated.__hooks.onDirectoryPageGetWait = () =>
      new Promise<void>((done) => {
        release = done;
        resolve();
      });
  });
  const racing = runListingWorker('worker-race');
  await entered;
  await publish('確定名', '変更肩書', 'https://example.test/changed.jpg');
  release();
  await racing;
  const racedCards = await cardsForUser();
  const racedProfile = await readProfile();
  const racedNewest = (await getNewestListed(20)).filter((item) => item.uid === UID);
  mark(
    '同期処理の冪等性',
    racedCards.length === 1 &&
      racedCards[0]?.card.name === '確定名' &&
      racedProfile?.name === '確定名' &&
      racedProfile?.seq === seq &&
      racedNewest.length === 1 &&
      racedNewest[0]?.name === '確定名' &&
      (await readOutbox()) == null
  );
  mark('seq維持', racedProfile?.seq === seq && racedProfile?.pageNo === pageNo);
  mark('重複登録防止', racedCards.length === 1 && racedNewest.length === 1);
  mark('新着一覧への反映', racedNewest[0]?.name === '確定名' && racedCards[0]?.card.name === '確定名');
  mark('固定ページへの反映', racedCards[0]?.card.name === '確定名');

  results.set(
    '本番Firestoreへの書き込み0件',
    remote.remoteAttempts.length === 0 &&
      isolated.__isolated === true &&
      !isolated.__stats.collections.has('firestore.googleapis.com')
      ? 'PASS'
      : 'FAIL'
  );

  const finalProfile = await readProfile();
  const finalCards = await cardsForUser();
  console.log(
    `observed\tseq=${String(finalProfile?.seq)} pageNo=${String(finalProfile?.pageNo)} cards=${finalCards.length} outbox=${(await readOutbox()) == null ? 'processed' : 'pending'} name=${String(finalProfile?.name)} title=${String(finalProfile?.title)} photo=${String(finalProfile?.photoUrl)}`
  );
  console.log(`redirected\t${(remote.redirected ?? []).join(',')}`);
  printResults();
  const failed = [...results.values()].some((status) => status !== 'PASS');
  process.exit(failed ? 1 : 0);
}

function printResults(): void {
  const order = [
    '名前変更',
    '肩書変更',
    '写真変更',
    '固定ページへの反映',
    '新着一覧への反映',
    'seq維持',
    '重複登録防止',
    '同期処理の冪等性',
    '途中失敗後の復旧',
    '本番Firestoreへの書き込み0件',
  ];
  for (const name of order) {
    console.log(`${results.get(name) ?? 'BLOCKED'}\t${name}`);
  }
  const stats = isolated.__stats;
  console.log(`environment\tin-memory-mock writes=${stats?.writes ?? 0}`);
  console.log(`collections\t${[...(stats?.collections ?? [])].join(',')}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'isolated listing test failed';
  console.error(message);
  printResults();
  process.exit(1);
});
