/**
 * 停止後の掲載反映。demo-procom-local の Emulator 以外には接続しない。
 * 実行: npx tsx --import ./scripts/onboarding-emulator/register-server-only.mjs scripts/onboarding-emulator/suspension-listing.ts
 */
import { applyIsolatedEnv, EMULATOR } from './isolate';

applyIsolatedEnv();

if (process.env.FIRESTORE_EMULATOR_HOST !== EMULATOR.firestoreHost) {
  throw new Error('Firestore Emulator の接続先がローカルではありません');
}
if (process.env.FIREBASE_PROJECT_ID !== EMULATOR.projectId) {
  throw new Error('project id が demo-procom-local ではありません');
}
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('本番の認証情報を外してから実行してください');
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const uid = `ban-${Date.now().toString(36)}`;
const other = `live-${Date.now().toString(36)}`;

const listing = await import('../../app/lib/listing/firestoreListing');
const admin = await import('../../app/lib/firebase-admin');
const db = admin.db;

const card = { uid, name: '停止', title: '肩書き', photoUrl: '' };
const otherCard = { uid: other, name: '公開', title: '肩書き', photoUrl: '' };

try {
  await db.collection('users').doc(uid).set({
    moderation: { suspended: true },
    profile: { isPublic: true, onboardingStatus: 'complete', name: '停止', title: '肩書き' },
  });
  await db.collection('publicProfiles').doc(uid).set({
    revision: 1,
    name: '停止',
    title: '肩書き',
    photoUrl: '',
    sortAtMs: 1,
    missingCreatedAt: false,
    hasPhoto: false,
    searchTokens: [],
    categorySlugs: [],
    seq: 1,
    pageNo: 1,
  });
  await db.collection('publicProfiles').doc(other).set({
    revision: 1,
    name: '公開',
    title: '肩書き',
    photoUrl: '',
    sortAtMs: 1,
    missingCreatedAt: false,
    hasPhoto: false,
    searchTokens: [],
    categorySlugs: [],
    seq: 2,
    pageNo: 1,
  });
  await db.collection('directoryPages').doc('1').set({ pageNo: 1, cards: [card, otherCard] });
  await db.collection('directoryMeta').doc('tail').set({ nextSeq: 3 });

  await listing.enqueueUserListing(uid);
  assert(!(await db.collection('publicProfiles').doc(uid).get()).exists, 'enqueue で publicProfiles を消す');
  assert((await db.collection('listingOutbox').doc(uid).get()).exists, 'enqueue で outbox を残す');
  const stored = (await db.collection('directoryPages').doc('1').get()).data()?.cards as { uid: string }[];
  assert(stored.some((item) => item.uid === uid), 'ワーカー前の directoryPages には古いカードが残る');

  const visible = await listing.omitCardsWithoutProfile(stored);
  assert(!visible.some((item) => item.uid === uid), '公開応答から停止ユーザーを外す');
  assert(visible.some((item) => item.uid === other), '公開中のカードは残す');

  await db.collection('directoryMeta').doc('lock').set({
    owner: 'other-worker',
    untilMs: Date.now() + 60_000,
    fence: 1,
  });
  const skipped = await listing.runListingWorker('suspend-test');
  assert(skipped.skippedLock === true, 'ロック中はワーカーを実行しない');
  assert((await db.collection('listingOutbox').doc(uid).get()).exists, 'ロック中も outbox を消さない');
  const duringLock = (await db.collection('directoryPages').doc('1').get()).data()?.cards as { uid: string }[];
  assert(duringLock.some((item) => item.uid === uid), 'ロック中は directoryPages を書き換えない');

  await db.collection('directoryMeta').doc('lock').delete();
  const ran = await listing.runListingWorker('suspend-test');
  assert(ran.skippedLock === false, 'ロック解除後は既存ワーカーを実行する');
  assert(!(await db.collection('listingOutbox').doc(uid).get()).exists, '反映後は outbox が無い');
  const after = (await db.collection('directoryPages').doc('1').get()).data()?.cards as { uid: string }[];
  assert(!after.some((item) => item.uid === uid), 'ワーカーが古いカードを消す');
  assert(after.some((item) => item.uid === other), '通常の掲載カードは残す');

  await db.collection('users').doc(uid).set(
    {
      moderation: { suspended: false },
      profile: { isPublic: true, onboardingStatus: 'required', name: '未完了', title: '肩書き' },
    },
    { merge: true }
  );
  await listing.enqueueUserListing(uid);
  assert(!(await db.collection('publicProfiles').doc(uid).get()).exists, '解除後も初期設定未完了なら掲載しない');

  console.log('suspension-listing emulator ok');
} finally {
  await Promise.all([
    db.collection('users').doc(uid).delete(),
    db.collection('publicProfiles').doc(uid).delete(),
    db.collection('publicProfiles').doc(other).delete(),
    db.collection('directoryPages').doc('1').delete(),
    db.collection('listingOutbox').doc(uid).delete(),
    db.collection('listingTombstones').doc(uid).delete(),
    db.collection('directoryMeta').doc('lock').delete(),
    db.collection('directoryMeta').doc('tail').delete(),
    db.collection('directoryMeta').doc('health').delete(),
  ]);
}
