/**
 * 公開一覧の移行。既定は dry-run で、users は読まない以外の変更をしない。
 *
 * 読み取りだけ:
 *   npx tsx scripts/listing-migrate.ts
 *
 * 書き込み（両方必要）:
 *   LISTING_BACKFILL_APPROVED=yes npx tsx scripts/listing-migrate.ts --apply
 *
 * このスクリプトは LISTING_DIRECTORY_READY を変更しない。
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import admin from 'firebase-admin';

import { lockAllowsWrite, tryAcquireLock, type ListingFields, type LiveProfile, type OutboxItem, type PageCard } from '@/lib/listing/engine';
import {
  assertNotUsersPath,
  emptyMigrationState,
  inspectMigration,
  planMigration,
  type MigrateUser,
  type MigrationState,
} from '@/lib/listing/migrate';
import { categorySlugsForTitle, searchTokensFor } from '@/lib/listing/searchText';
import { LEGACY_SCAN_LIMIT } from '@/lib/listing/readiness';
import { positiveMillis, readContentUpdatedAtMs } from '@/lib/profileContent';
import { createdAtToMillis } from '@/lib/publicUserDirectory';
import { isProfilePublic } from '@/lib/userSeo';

const APPLY = process.argv.includes('--apply');
const APPROVED = process.env.LISTING_BACKFILL_APPROVED === 'yes';

if (APPLY && !APPROVED) {
  console.error('書き込みは --apply と LISTING_BACKFILL_APPROVED=yes の両方が必要です。中止しました。');
  process.exit(1);
}

function photoUrlOf(profile: Record<string, unknown>): string {
  const photos = profile.photos;
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const first = photos[0];
  if (typeof first === 'string') return first.trim();
  if (first && typeof first === 'object' && 'url' in first) {
    const url = (first as { url?: unknown }).url;
    return typeof url === 'string' ? url.trim() : '';
  }
  return '';
}

function fieldsFromUser(data: admin.firestore.DocumentData | undefined): ListingFields {
  const profile =
    data?.profile && typeof data.profile === 'object' ? (data.profile as Record<string, unknown>) : {};
  const name = typeof profile.name === 'string' ? profile.name : '';
  const title = typeof profile.title === 'string' ? profile.title : '';
  const photoUrl = photoUrlOf(profile);
  const createdAtMs = createdAtToMillis(data?.createdAt);
  return {
    name,
    title,
    photoUrl,
    sortAtMs: createdAtMs ?? 0,
    missingCreatedAt: createdAtMs == null,
    hasPhoto: photoUrl.length > 0,
    contentUpdatedAtMs: readContentUpdatedAtMs(profile),
    searchTokens: searchTokensFor(name, title),
    categorySlugs: categorySlugsForTitle(title),
  };
}

function profileFromData(uid: string, data: admin.firestore.DocumentData | undefined): LiveProfile | null {
  if (!data) return null;
  return {
    uid,
    revision: typeof data.revision === 'number' ? data.revision : 0,
    name: typeof data.name === 'string' ? data.name : '',
    title: typeof data.title === 'string' ? data.title : '',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    sortAtMs: typeof data.sortAtMs === 'number' ? data.sortAtMs : 0,
    missingCreatedAt: data.missingCreatedAt === true,
    hasPhoto: data.hasPhoto === true,
    contentUpdatedAtMs: positiveMillis(data.contentUpdatedAtMs),
    searchTokens: Array.isArray(data.searchTokens) ? data.searchTokens.filter((item) => typeof item === 'string') : [],
    categorySlugs: Array.isArray(data.categorySlugs)
      ? data.categorySlugs.filter((item) => typeof item === 'string')
      : [],
    seq: typeof data.seq === 'number' ? data.seq : null,
    pageNo: typeof data.pageNo === 'number' ? data.pageNo : null,
  };
}

function outboxFromData(uid: string, data: admin.firestore.DocumentData | undefined): OutboxItem | null {
  if (!data || typeof data.revision !== 'number') return null;
  if (data.op !== 'upsert' && data.op !== 'remove') return null;
  return {
    uid,
    revision: data.revision,
    op: data.op,
    pageNo: typeof data.pageNo === 'number' ? data.pageNo : null,
  };
}

async function readState(
  db: admin.firestore.Firestore,
  userDocs: admin.firestore.QueryDocumentSnapshot[]
): Promise<{ users: MigrateUser[]; state: MigrationState }> {
  const users: MigrateUser[] = userDocs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      isPublic: isProfilePublic(data.profile),
      createdAtMs: createdAtToMillis(data.createdAt),
      fields: fieldsFromUser(data),
    };
  });
  const [profiles, tombs, outbox, pages, tail] = await Promise.all([
    db.collection('publicProfiles').get(),
    db.collection('listingTombstones').get(),
    db.collection('listingOutbox').get(),
    db.collection('directoryPages').get(),
    db.collection('directoryMeta').doc('tail').get(),
  ]);
  const state = emptyMigrationState();
  for (const doc of profiles.docs) {
    const profile = profileFromData(doc.id, doc.data());
    if (profile) state.profiles.set(doc.id, profile);
  }
  for (const doc of tombs.docs) {
    const revision = doc.data().revision;
    if (typeof revision === 'number') state.tombstones.set(doc.id, revision);
  }
  for (const doc of outbox.docs) {
    const item = outboxFromData(doc.id, doc.data());
    if (item) state.outbox.set(doc.id, item);
  }
  for (const doc of pages.docs) {
    const pageNo = Number(doc.id);
    const cards = doc.data().cards;
    if (!Number.isInteger(pageNo) || !Array.isArray(cards)) continue;
    state.pages.set(
      pageNo,
      cards.filter((card): card is PageCard => Boolean(card) && typeof card.uid === 'string')
    );
  }
  const nextSeq = tail.data()?.nextSeq;
  state.nextSeq = typeof nextSeq === 'number' && nextSeq >= 1 ? nextSeq : 1;
  return { users, state };
}

function printReport(prefix: string, report: ReturnType<typeof planMigration>['report']): void {
  console.log(
    `${prefix} public=${report.publicCount} pages=${report.pageSizes.join(',') || '-'} writes=${report.writes} skips=${report.skips} currentReady=${report.currentReady} plannedReady=${report.plannedReady} canApply=${report.canApply}`
  );
  for (const problem of report.problems) console.log(`problem ${problem}`);
  console.log('users コレクションは変更しません。LISTING_DIRECTORY_READY は変更しません。');
}

async function main(): Promise<void> {
  loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
  loadEnv({ path: path.resolve(process.cwd(), '.env') });
  const keyPath = process.env.FIREBASE_KEY_PATH;
  if (!keyPath) throw new Error('FIREBASE_KEY_PATH が未設定です');
  const resolved = path.resolve(keyPath);
  if (!fs.existsSync(resolved)) throw new Error('秘密鍵ファイルが見つかりません');
  const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('秘密鍵の形式が不正です');
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      }),
    });
  }
  const db = admin.firestore();
  const counted = await db.collection('users').count().get();
  const total = counted.data().count;
  if (total > LEGACY_SCAN_LIMIT) {
    throw new Error(`users が ${total} 件あるため中止しました`);
  }
  const userSnap = await db
    .collection('users')
    .select('createdAt', 'profile.isPublic', 'profile.name', 'profile.title', 'profile.photos')
    .get();
  const loaded = await readState(db, userSnap.docs);
  const planned = planMigration(loaded.users, loaded.state);
  printReport(APPLY ? 'apply-plan' : 'dry-run', planned.report);
  if (!planned.report.currentReady) {
    console.log('currentReady=false のため、LISTING_DIRECTORY_READY は設定しないでください。');
  }
  if (!APPLY) {
    process.exit(planned.report.canApply && planned.report.plannedReady ? 0 : 2);
  }
  if (!planned.report.canApply || !planned.report.plannedReady) {
    console.error('整合性が取れないため書き込みません。READY には切り替えないでください。');
    process.exit(2);
  }

  const lockRef = db.collection('directoryMeta').doc('lock');
  const owner = `migrate-${Date.now()}`;
  const acquired = await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data();
    const probe = emptyMigrationState();
    if (data && typeof data.untilMs === 'number' && typeof data.owner === 'string') {
      probe.nextSeq = 1;
      const lockState = {
        profiles: probe.profiles,
        tombstones: probe.tombstones,
        outbox: probe.outbox,
        pages: probe.pages,
        nextSeq: 1,
        lock: {
          owner: data.owner,
          untilMs: data.untilMs,
          fence: typeof data.fence === 'number' ? data.fence : 0,
        },
      };
      const result = tryAcquireLock(lockState, owner, Date.now(), 120_000);
      if (!result.ok || !result.state.lock) return null;
      assertNotUsersPath('directoryMeta');
      tx.set(lockRef, result.state.lock);
      return result.fence;
    }
    const result = tryAcquireLock(
      { ...probe, lock: null },
      owner,
      Date.now(),
      120_000
    );
    if (!result.ok || !result.state.lock) return null;
    assertNotUsersPath('directoryMeta');
    tx.set(lockRef, result.state.lock);
    return result.fence;
  });
  if (acquired == null) {
    console.error('一覧ロックを取得できません。ワーカー終了後に再実行してください。');
    process.exit(1);
  }

  try {
    await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      const lockData = lockSnap.data();
      const lock =
        lockData && typeof lockData.untilMs === 'number' && typeof lockData.owner === 'string'
          ? {
              owner: lockData.owner,
              untilMs: lockData.untilMs,
              fence: typeof lockData.fence === 'number' ? lockData.fence : 0,
            }
          : null;
      if (!lockAllowsWrite(lock, owner, acquired, Date.now())) {
        throw new Error('移行ロックが無効です');
      }
      const freshUsers = await Promise.all(
        loaded.users.map(async (user) => {
          const snap = await tx.get(db.collection('users').doc(user.uid));
          const data = snap.data();
          return {
            uid: user.uid,
            isPublic: snap.exists && isProfilePublic(data?.profile),
            createdAtMs: createdAtToMillis(data?.createdAt),
            fields: fieldsFromUser(data),
          } satisfies MigrateUser;
        })
      );
      const fresh = emptyMigrationState();
      for (const user of freshUsers) {
        const [profileSnap, tombSnap, outSnap] = await Promise.all([
          tx.get(db.collection('publicProfiles').doc(user.uid)),
          tx.get(db.collection('listingTombstones').doc(user.uid)),
          tx.get(db.collection('listingOutbox').doc(user.uid)),
        ]);
        const profile = profileFromData(user.uid, profileSnap.data());
        if (profile) fresh.profiles.set(user.uid, profile);
        const tomb = tombSnap.data()?.revision;
        if (typeof tomb === 'number') fresh.tombstones.set(user.uid, tomb);
        const out = outboxFromData(user.uid, outSnap.data());
        if (out) fresh.outbox.set(user.uid, out);
      }
      const tailSnap = await tx.get(db.collection('directoryMeta').doc('tail'));
      const nextSeq = tailSnap.data()?.nextSeq;
      fresh.nextSeq = typeof nextSeq === 'number' && nextSeq >= 1 ? nextSeq : 1;
      for (const [pageNo] of planned.state.pages) {
        const pageSnap = await tx.get(db.collection('directoryPages').doc(String(pageNo)));
        const cards = pageSnap.data()?.cards;
        if (Array.isArray(cards)) {
          fresh.pages.set(
            pageNo,
            cards.filter((card): card is PageCard => Boolean(card) && typeof card.uid === 'string')
          );
        }
      }
      const again = planMigration(freshUsers, fresh);
      if (!again.report.canApply || !again.report.plannedReady) {
        throw new Error('再読込後の計画が不整合です');
      }
      for (const action of again.actions) {
        if (action.type === 'skip') continue;
        if (action.type === 'upsert') {
          assertNotUsersPath('publicProfiles');
          assertNotUsersPath('listingOutbox');
          assertNotUsersPath('listingTombstones');
          tx.set(db.collection('publicProfiles').doc(action.uid), action.profile);
          tx.set(db.collection('listingOutbox').doc(action.uid), {
            uid: action.uid,
            revision: action.profile.revision,
            op: 'upsert',
            pageNo: action.profile.pageNo,
          });
          tx.delete(db.collection('listingTombstones').doc(action.uid));
        } else {
          assertNotUsersPath('publicProfiles');
          assertNotUsersPath('listingOutbox');
          assertNotUsersPath('listingTombstones');
          tx.delete(db.collection('publicProfiles').doc(action.uid));
          tx.set(db.collection('listingTombstones').doc(action.uid), { revision: action.revision });
          tx.set(db.collection('listingOutbox').doc(action.uid), {
            uid: action.uid,
            revision: action.revision,
            op: 'remove',
            pageNo: action.pageNo,
          });
        }
      }
      assertNotUsersPath('directoryPages');
      assertNotUsersPath('directoryMeta');
      for (const [pageNo, cards] of again.state.pages) {
        tx.set(db.collection('directoryPages').doc(String(pageNo)), { pageNo, cards });
      }
      tx.set(db.collection('directoryMeta').doc('tail'), { nextSeq: again.state.nextSeq }, { merge: true });
    });
  } finally {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      const data = snap.data();
      if (data?.owner === owner && data?.fence === acquired) tx.delete(lockRef);
    });
  }

  const verifiedUsers = await db
    .collection('users')
    .select('createdAt', 'profile.isPublic', 'profile.name', 'profile.title', 'profile.photos')
    .get();
  const after = await readState(db, verifiedUsers.docs);
  const publicUids = after.users.filter((user) => user.isPublic).map((user) => user.uid);
  const checked = inspectMigration(publicUids, after.state);
  console.log(
    `verify ready=${checked.ready} public=${publicUids.length} pages=${checked.pageSizes.join(',') || '-'}`
  );
  for (const problem of checked.problems) console.log(`problem ${problem}`);
  if (!checked.ready) {
    console.error('検証に失敗しました。LISTING_DIRECTORY_READY は設定しないでください。');
    process.exit(2);
  }
  console.log('検証に成功しました。READY 切り替えは別操作です。');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'migration failed';
  console.error(message);
  process.exit(1);
});
