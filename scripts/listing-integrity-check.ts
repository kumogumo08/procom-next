/**
 * 一覧同期のローカル検査。Firestore へは読み取りだけ。
 * 実行: npx tsx scripts/listing-integrity-check.ts
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import admin from 'firebase-admin';

import { planBackfill } from '@/lib/listing/backfill';
import {
  commitDecision,
  emptyListingState,
  enqueueListing,
  lockAllowsWrite,
  pageNoForSeq,
  planSync,
  stepListing,
  tryAcquireLock,
  type ListingFields,
  type ListingState,
} from '@/lib/listing/engine';
import { crawlPageNumbers, pageCountFromNextSeq } from '@/lib/listing/links';
import { publicHealth } from '@/lib/listing/health';
import { assessDirectoryReady, assertLegacyScanAllowed, isListingDirectoryReady } from '@/lib/listing/readiness';
import {
  SEARCH_READ_BUDGET,
  categorySlugsForTitle,
  matchWithinBudget,
  matchesSubstring,
  queryToken,
  searchTokensFor,
} from '@/lib/listing/searchText';
import { sitemapIndexPaths } from '@/lib/listing/sitemapXml';
import { nextRateCount } from '@/lib/rateLimit';
import { sliceDirectoryPage } from '@/lib/publicUserDirectory';
import { createdAtToMillis } from '@/lib/publicUserDirectory';
import { isProfilePublic } from '@/lib/userSeo';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function fields(name: string, title = ''): ListingFields {
  return {
    name,
    title,
    photoUrl: '',
    sortAtMs: 1,
    missingCreatedAt: false,
    hasPhoto: false,
    searchTokens: searchTokensFor(name, title),
    categorySlugs: categorySlugsForTitle(title),
  };
}

function upsert(state: ListingState, uid: string, name: string, title = ''): ListingState {
  return enqueueListing(state, uid, 'upsert', fields(name, title)).state;
}

function testSync(): void {
  let state = emptyListingState();
  state = upsert(state, 'a', '山田');
  state = stepListing(state, 'a');
  assert(state.profiles.get('a')?.seq === 1, '登録で seq 1');
  assert(state.profiles.get('a')?.pageNo === 1, 'seq 1 はページ 1');
  assert(!state.outbox.has('a'), '同期後に outbox が残らない');

  state = upsert(state, 'a', '山田更新', 'ダンサー');
  const revision = state.profiles.get('a')?.revision ?? 0;
  state = stepListing(state, 'a');
  assert(state.profiles.get('a')?.seq === 1, '更新で seq を変えない');
  assert(state.profiles.get('a')?.name === '山田更新', '更新がカードへ届く');
  assert(state.pages.get(1)?.some((card) => card.name === '山田更新') === true, 'ページカードが更新される');

  const stale = planSync(
    (() => {
      const probe = emptyListingState();
      probe.nextSeq = state.nextSeq;
      probe.profiles = state.profiles;
      probe.pages = state.pages;
      probe.outbox.set('a', { uid: 'a', revision: revision - 1, op: 'upsert', pageNo: 1 });
      return probe;
    })(),
    'a'
  );
  assert(stale.action === 'drop-outbox', '古い更新は新しいプロフィールを消さない');

  state = enqueueListing(state, 'a', 'remove').state;
  state = stepListing(state, 'a');
  assert(!state.profiles.has('a'), '非公開でプロフィールを消す');
  assert((state.pages.get(1) ?? []).every((card) => card.uid !== 'a'), '非公開でカードを消す');
  assert((state.tombstones.get('a') ?? 0) > 0, '墓標が残る');

  state.outbox.set('a', { uid: 'a', revision: 1, op: 'upsert', pageNo: 1 });
  state = stepListing(state, 'a');
  assert(!state.profiles.has('a'), '退会後に古い更新が復活しない');

  state = upsert(state, 'b', '二番');
  state = stepListing(state, 'b');
  assert(state.profiles.get('b')?.seq === 2, '空いた seq 1 は再利用しない');

  state = upsert(state, 'a', '再公開');
  state = stepListing(state, 'a');
  assert(state.profiles.get('a')?.seq === 3, '再公開は新しい seq');
  const seqs = [...state.profiles.values()].map((profile) => profile.seq);
  assert(new Set(seqs).size === seqs.length, 'seq が重複しない');
}

function testConcurrencyAndRetry(): void {
  let state = emptyListingState();
  state = upsert(state, 'a', 'A');
  state = upsert(state, 'b', 'B');
  const first = planSync(state, 'a');
  const second = planSync(state, 'b');
  assert(first.action === 'place' && second.action === 'place', '同時登録は両方 place');
  if (first.action !== 'place' || second.action !== 'place') return;
  assert(first.seq === 1 && second.seq === 1, 'コミット前は同じ nextSeq を見る');
  const committed = commitDecision(state, first);
  assert(committed !== null, '先にコミットした方が成功');
  state = committed ?? state;
  assert(commitDecision(state, second) === null, '古い決定は次の seq を奪わない');
  state = stepListing(state, 'b');
  assert(state.profiles.get('a')?.seq === 1 && state.profiles.get('b')?.seq === 2, '再計画で次の seq');

  state.outbox.set('b', { uid: 'b', revision: state.profiles.get('b')?.revision ?? 0, op: 'upsert', pageNo: 1 });
  const before = state.nextSeq;
  state = stepListing(state, 'b');
  assert(state.nextSeq === before, 'seq 済みの再実行は採番しない');
  assert(state.profiles.get('b')?.seq === 2, '再実行で seq が変わらない');

  const decision = planSync(upsert(emptyListingState(), 'c', 'C'), 'c');
  assert(decision.action === 'place' && decision.assign, '未採番は assign');
  let partial = upsert(emptyListingState(), 'c', 'C');
  partial = commitDecision(partial, decision) ?? partial;
  partial.outbox.set('c', {
    uid: 'c',
    revision: partial.profiles.get('c')?.revision ?? 0,
    op: 'upsert',
    pageNo: partial.profiles.get('c')?.pageNo ?? null,
  });
  const seq = partial.profiles.get('c')?.seq;
  const next = partial.nextSeq;
  partial = stepListing(partial, 'c');
  assert(partial.profiles.get('c')?.seq === seq && partial.nextSeq === next, '途中失敗の再実行で seq が増えない');
}

function testLock(): void {
  const state = emptyListingState();
  const first = tryAcquireLock(state, 'worker-a', 1_000, 120_000);
  assert(first.ok, '最初のワーカーがロックを取る');
  assert(lockAllowsWrite(first.state.lock, 'worker-a', first.fence, 1_000 + 10), '取得直後は書ける');
  const blocked = tryAcquireLock(first.state, 'worker-b', 1_000 + 60_000, 120_000);
  assert(!blocked.ok, '期限内の別ワーカーは取れない');
  const expired = tryAcquireLock(first.state, 'worker-b', 1_000 + 120_000, 120_000);
  assert(expired.ok && expired.fence !== first.fence, '期限切れ後は別 fence で取る');
  assert(
    !lockAllowsWrite(expired.state.lock, 'worker-a', first.fence, 1_000 + 120_000),
    '旧ワーカーは期限後に書けない'
  );
  const same = tryAcquireLock(first.state, 'worker-a', 1_000 + 10, 120_000);
  assert(same.ok && same.fence !== first.fence, '同じ所有者の再取得は fence を進める');
  assert(!lockAllowsWrite(same.state.lock, 'worker-a', first.fence, 1_000 + 10), '古い fence では書けない');
}

function testUpdateDuringSync(): void {
  let state = upsert(emptyListingState(), 'a', '旧名');
  state.pages.set(1, [{ uid: 'other', name: '他', title: '', photoUrl: '' }]);
  const decision = planSync(state, 'a');
  state = upsert(state, 'a', '新名', '歌手');
  assert(commitDecision(state, decision) === null, '処理中の更新は古い決定を捨てる');
  assert(state.profiles.get('a')?.name === '新名', '新しい名前が残る');
  state = stepListing(state, 'a');
  const cards = state.pages.get(1) ?? [];
  assert(cards.some((card) => card.uid === 'other'), '同じページの他カードを消さない');
  assert(cards.some((card) => card.uid === 'a' && card.name === '新名'), '更新後の名前でカードを書く');
  assert(!state.outbox.has('a'), '処理後の outbox は空');
}

function testReregisterAndRecovery(): void {
  let state = upsert(emptyListingState(), 'a', '最初');
  state = stepListing(state, 'a');
  const firstSeq = state.profiles.get('a')?.seq;
  state = enqueueListing(state, 'a', 'remove').state;
  const removeDecision = planSync(state, 'a');
  state = upsert(state, 'a', '再登録');
  assert(commitDecision(state, removeDecision) === null, '再登録後の古い退会は適用しない');
  assert(state.profiles.has('a'), '再登録のプロフィールが残る');
  state = stepListing(state, 'a');
  assert(state.profiles.get('a')?.seq !== firstSeq, '再登録は空いた seq を再利用しない');
  assert((state.tombstones.get('a') ?? 0) === 0, '再登録で墓標を消す');

  let queued = upsert(emptyListingState(), 'b', '停止');
  queued = upsert(queued, 'c', '復旧');
  const crashed = tryAcquireLock(queued, 'old', 0, 1_000);
  queued = crashed.state;
  const recovered = tryAcquireLock(queued, 'new', 5_000, 1_000);
  queued = recovered.state;
  queued = stepListing(queued, 'b');
  queued = stepListing(queued, 'c');
  assert(queued.profiles.get('b')?.seq === 1 && queued.profiles.get('c')?.seq === 2, '停止後もキューを処理する');
  assert(!lockAllowsWrite(queued.lock, 'old', crashed.fence, 5_000), '復旧後の旧ワーカーは書けない');
  assert(queued.outbox.size === 0, '復旧で outbox が残らない');
}

function testBacklogDoesNotHideProfile(): void {
  const state = upsert(emptyListingState(), 'a', '即時');
  assert(state.profiles.has('a'), 'ワーカー前でも公開プロフィールがある');
  assert((state.pages.get(1) ?? []).length === 0, '固定ページはワーカー待ち');
  assert(state.outbox.has('a'), 'outbox が滞留していてもプロフィールは残る');
}

function testNumbering(): void {
  assert(pageNoForSeq(45) === 3, '45人目はページ 3');
  assert(pageNoForSeq(61) === 4, '61人目からページ 4');
  assert(pageCountFromNextSeq(45) === 3, '44人のとき固定ページは 3');
  assert(pageCountFromNextSeq(1) === 0, '未採番なら固定ページなし');
}

function testSearch(): void {
  assert(queryToken('あ') === null, '1文字は新しい検索のトークンを作らない');
  assert(!matchesSubstring('山田', '歌手', '歌'), '1文字は新しい部分一致の対象外');
  assert(queryToken('ダンサー') === 'ダン', '先頭2-gram');
  assert(searchTokensFor('東京ダンサー', '').includes('ダン'), '途中の2-gramも保存する');
  assert(matchesSubstring('東京ダンサー', '', 'ダンサー'), '前方一致でなくても部分一致で残す');
  assert(matchesSubstring('山田', 'プロ歌手', '歌手'), '肩書の部分一致');
  assert(!matchesSubstring('あいえお', '', 'あいう'), '2-gramが同じでも部分一致しなければ落とす');
  assert(categorySlugsForTitle('プロのダンサー').includes('ダンサー'), 'カテゴリは肩書の部分一致');
  assert(categorySlugsForTitle('YouTuber').includes('YouTuber'), 'YouTuber を残す');
  const people = Array.from({ length: 100 }, (_, index) => ({
    name: index === 90 ? '特別ダンサー' : `あい共通${index}`,
    title: index === 90 ? '' : 'あい共通',
  }));
  const found = matchWithinBudget(people, '特別ダンサー', SEARCH_READ_BUDGET);
  assert(found.matched.length === 1 && !found.truncated, '100件中の後半一致を予算200で残す');
  const missed = matchWithinBudget(people, '特別ダンサー', 40);
  assert(missed.matched.length === 0 && missed.truncated, '予算40では後半一致が欠ける');
  const pages = sliceDirectoryPage(found.matched.length === 1 ? Array.from({ length: 45 }, (_, index) => index) : [], 2);
  assert(pages.length === 20 && pages[0] === 20, '検索結果は20件ずつページ分割できる');
  assert(SEARCH_READ_BUDGET === 200, '検索の読み取り上限は200');
}

function testSwitchAndSharedLimit(): void {
  assert(!isListingDirectoryReady(undefined) && isListingDirectoryReady('1'), '準備完了フラグは 1 のときだけ');
  assertLegacyScanAllowed(44);
  let refused = false;
  try {
    assertLegacyScanAllowed(501);
  } catch {
    refused = true;
  }
  assert(refused, '501人の旧全件読みは拒否する');
  const uids = Array.from({ length: 44 }, (_, index) => `u${index}`);
  const ready = assessDirectoryReady({ publicUids: uids, listedUids: uids, pageUids: uids });
  assert(ready.ready, '44人全員がページにあれば切り替え可');
  const empty = assessDirectoryReady({ publicUids: uids, listedUids: [], pageUids: [] });
  assert(!empty.ready && empty.missing === 44, '一覧が空なら切り替えない');
  let count = 0;
  const first = nextRateCount(count, 2);
  count = first.count;
  const second = nextRateCount(count, 2);
  count = second.count;
  const third = nextRateCount(count, 2);
  assert(first.ok && second.ok && !third.ok, '共有カウンタはインスタンスをまたいで上限になる');
  const health = publicHealth({
    lastError: 'Bearer secret-value private_key LISTING_SYNC_SECRET',
    processed: 3,
    secret: 'do-not-leak',
    lastFinishedAt: '2026-10-12T00:00:00.000Z',
  });
  assert(!JSON.stringify(health).includes('secret-value'), '監視応答に秘密を含めない');
  assert(!('secret' in health), '監視応答は決めた項目だけ');
  assert(health.processed === 3, '処理件数は返す');
  const paths = sitemapIndexPaths(3);
  assert(paths[0] === '/sitemaps/core' && paths[1] === '/sitemaps/pages' && paths.length === 3, '44人規模はプロフィール1分割');
  assert(sitemapIndexPaths(0).length === 2, '固定ページが無い索引にプロフィール分割は出さない');
}

function testBackfillReachability(): void {
  const rows = Array.from({ length: 45 }, (_, index) => {
    const n = index + 1;
    return {
      uid: `u${String(n).padStart(2, '0')}`,
      createdAtMs: n <= 17 ? 1_700_000_000_000 - n : null,
      isPublic: n !== 45,
    };
  });
  const planned = planBackfill(rows);
  assert(planned.length === 44, '非公開を除いて44人');
  const sizes = [1, 2, 3].map(
    (page) => planned.filter((row) => row.pageNo === page).length
  );
  assert(sizes.join(',') === '20,20,4', `ページ人数 ${sizes.join(',')}`);
  const firstMissing = planned.findIndex((row) => row.createdAtMs == null);
  assert(firstMissing === 17, 'createdAt なしは末尾');
  assert(planned.slice(firstMissing).every((row) => row.createdAtMs == null), '末尾は全員 createdAt なし');
  assert(new Set(planned.map((row) => row.seq)).size === 44, 'seq が一意');

  const byPage = new Map<number, string[]>();
  for (const row of planned) {
    const list = byPage.get(row.pageNo) ?? [];
    list.push(row.uid);
    byPage.set(row.pageNo, list);
  }
  const pageCount = 3;
  const seen = new Set<number>();
  const queue = [1];
  while (queue.length > 0) {
    const page = queue.shift();
    if (page == null || seen.has(page) || page > pageCount) continue;
    seen.add(page);
    for (const next of crawlPageNumbers(page, pageCount)) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  const hrefs = new Set<string>(['/users', '/users?page=1']);
  const newest = [...planned].sort((a, b) => {
    if (a.createdAtMs != null && b.createdAtMs != null && a.createdAtMs !== b.createdAtMs) {
      return b.createdAtMs - a.createdAtMs;
    }
    if (a.createdAtMs == null) return 1;
    if (b.createdAtMs == null) return -1;
    return a.uid < b.uid ? -1 : 1;
  });
  for (const row of newest.slice(0, 20)) hrefs.add(`/user/${row.uid}`);
  for (const page of seen) {
    hrefs.add(`/users?page=${page}`);
    for (const uid of byPage.get(page) ?? []) hrefs.add(`/user/${uid}`);
  }
  const missing = planned.filter((row) => !hrefs.has(`/user/${row.uid}`));
  assert(missing.length === 0, '固定ページのリンクから全員に到達できる');
  assert(seen.has(2) && seen.has(3), '1ページ目から2と3へ到達できる');
}

async function dryRunExistingUsers(): Promise<void> {
  loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
  loadEnv({ path: path.resolve(process.cwd(), '.env') });
  const keyPath = process.env.FIREBASE_KEY_PATH;
  if (!keyPath) throw new Error('FIREBASE_KEY_PATH が無いためドライランできません');
  const resolved = path.resolve(keyPath);
  if (!fs.existsSync(resolved)) throw new Error('秘密鍵ファイルが見つかりません');
  const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('秘密鍵の形式が不正です');
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
  }
  const db = admin.firestore();
  const counted = await db.collection('users').count().get();
  const total = counted.data().count;
  assert(total <= 500, `users が ${total} 件あるため全件読みを中止しました`);
  const snap = await db.collection('users').select('createdAt', 'profile.isPublic').get();
  assert(snap.size === total, 'select の件数と count が一致しない');
  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      createdAtMs: createdAtToMillis(data.createdAt),
      isPublic: isProfilePublic(data.profile),
    };
  });
  const planned = planBackfill(rows);
  const publicCount = planned.length;
  const privateCount = rows.length - publicCount;
  const missingCreatedAt = planned.filter((row) => row.createdAtMs == null).length;
  const sizes = new Map<number, number>();
  for (const row of planned) sizes.set(row.pageNo, (sizes.get(row.pageNo) ?? 0) + 1);
  const sizeList = [...sizes.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
  assert(publicCount === 44, `公開人数が44ではありません: ${publicCount}`);
  assert(sizeList.join(',') === '20,20,4', `ページ構成が 20,20,4 ではありません: ${sizeList.join(',')}`);
  assert(new Set(planned.map((row) => row.seq)).size === publicCount, 'ドライランの seq が重複');
  const firstMissing = planned.findIndex((row) => row.createdAtMs == null);
  if (missingCreatedAt > 0) {
    assert(
      planned.slice(firstMissing).every((row) => row.createdAtMs == null),
      'createdAt なしが createdAt ありより前に並んだ'
    );
  }
  const pageCount = sizeList.length;
  const seen = new Set<number>();
  const queue = pageCount > 0 ? [1] : [];
  while (queue.length > 0) {
    const page = queue.shift();
    if (page == null || seen.has(page) || page > pageCount) continue;
    seen.add(page);
    for (const next of crawlPageNumbers(page, pageCount)) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  const linked = new Set<string>();
  for (const page of seen) {
    for (const row of planned.filter((item) => item.pageNo === page)) linked.add(row.uid);
  }
  assert(linked.size === publicCount, `到達 ${linked.size} / ${publicCount}`);
  console.log(
    `dry-run public=${publicCount} private=${privateCount} pages=${sizeList.join(',')} missingCreatedAt=${missingCreatedAt} reachable=${linked.size} writes=0`
  );
  const profileCount = (await db.collection('publicProfiles').count().get()).data().count;
  console.log(
    `production-switch ready=false publicProfiles=${profileCount} expectedPublic=${publicCount} writes=0`
  );
}

testSync();
testConcurrencyAndRetry();
testLock();
testUpdateDuringSync();
testReregisterAndRecovery();
testBacklogDoesNotHideProfile();
testNumbering();
testSearch();
testSwitchAndSharedLimit();
testBackfillReachability();
await dryRunExistingUsers();
console.log('listing integrity: ok');
