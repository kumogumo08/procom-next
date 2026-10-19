import 'server-only';

import { unstable_cache } from 'next/cache';

import type { DocumentData } from 'firebase-admin/firestore';

import { db } from '@/lib/firebase-admin';
import { positiveMillis, readContentUpdatedAtMs } from '@/lib/profileContent';
import { createdAtToMillis } from '@/lib/publicUserDirectory';
import { isProfilePublic } from '@/lib/userSeo';

import {
  commitDecision,
  emptyListingState,
  enqueueListing,
  lockAllowsWrite,
  planSync,
  tryAcquireLock,
  type ListingFields,
  type LiveProfile,
  type PageCard,
} from './engine';
import { publicHealth, sanitizeHealthError } from './health';
import { pageCountFromNextSeq } from './links';
import { categorySlugsForTitle, searchTokensFor } from './searchText';

const PROFILES = 'publicProfiles';
const OUTBOX = 'listingOutbox';
const TOMBSTONES = 'listingTombstones';
const PAGES = 'directoryPages';
const META = 'directoryMeta';
const DEAD = 'listingDead';

const LOCK_TTL_MS = 120_000;
const WORKER_BATCH = 20;
const DEAD_LETTER_ATTEMPTS = 10;

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

export function fieldsFromUserData(data: Record<string, unknown> | undefined): ListingFields {
  const profile =
    data?.profile && typeof data.profile === 'object'
      ? (data.profile as Record<string, unknown>)
      : {};
  const name = typeof profile.name === 'string' ? profile.name : '';
  const title = typeof profile.title === 'string' ? profile.title : '';
  const photoUrl = photoUrlOf(profile);
  const sortAtMs = createdAtToMillis(data?.createdAt) ?? 0;
  return {
    name,
    title,
    photoUrl,
    sortAtMs,
    missingCreatedAt: createdAtToMillis(data?.createdAt) == null,
    hasPhoto: photoUrl.length > 0,
    contentUpdatedAtMs: readContentUpdatedAtMs(profile),
    searchTokens: searchTokensFor(name, title),
    categorySlugs: categorySlugsForTitle(title),
  };
}

type StoredProfile = LiveProfile;

function profileFromDoc(uid: string, data: DocumentData | undefined): StoredProfile | null {
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
    searchTokens: Array.isArray(data.searchTokens) ? data.searchTokens.filter((t) => typeof t === 'string') : [],
    categorySlugs: Array.isArray(data.categorySlugs) ? data.categorySlugs.filter((t) => typeof t === 'string') : [],
    seq: typeof data.seq === 'number' ? data.seq : null,
    pageNo: typeof data.pageNo === 'number' ? data.pageNo : null,
  };
}

/** 登録・更新・退会のあと。失敗しても呼び出し元の users 書き込みは戻さない。 */
export async function noteUserListing(uid: string): Promise<void> {
  try {
    await enqueueUserListing(uid);
  } catch (err) {
    console.error('listing enqueue failed:', uid, err);
  }
}

export async function enqueueUserListing(uid: string): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  const profileRef = db.collection(PROFILES).doc(uid);
  const outboxRef = db.collection(OUTBOX).doc(uid);
  const tombRef = db.collection(TOMBSTONES).doc(uid);

  await db.runTransaction(async (tx) => {
    const [userSnap, profileSnap, outboxSnap, tombSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(profileRef),
      tx.get(outboxRef),
      tx.get(tombRef),
    ]);
    const state = emptyListingState();
    const profile = profileFromDoc(uid, profileSnap.data());
    if (profile) state.profiles.set(uid, profile);
    const tombRev = tombSnap.data()?.revision;
    if (typeof tombRev === 'number') state.tombstones.set(uid, tombRev);
    const outRev = outboxSnap.data()?.revision;
    const outOp = outboxSnap.data()?.op;
    if (typeof outRev === 'number' && (outOp === 'upsert' || outOp === 'remove')) {
      state.outbox.set(uid, {
        uid,
        revision: outRev,
        op: outOp,
        pageNo: typeof outboxSnap.data()?.pageNo === 'number' ? outboxSnap.data()?.pageNo : null,
      });
    }

    const userData = userSnap.data() as Record<string, unknown> | undefined;
    const listed = userSnap.exists && isProfilePublic(userData?.profile);
    const { state: next, revision } = listed
      ? enqueueListing(state, uid, 'upsert', fieldsFromUserData(userData))
      : enqueueListing(state, uid, 'remove');

    const live = next.profiles.get(uid);
    if (live) {
      tx.set(profileRef, { ...live, searchTokens: live.searchTokens, categorySlugs: live.categorySlugs });
    } else if (profileSnap.exists) {
      tx.delete(profileRef);
    }
    const tomb = next.tombstones.get(uid);
    if (typeof tomb === 'number') tx.set(tombRef, { revision: tomb });
    else if (tombSnap.exists) tx.delete(tombRef);
    const out = next.outbox.get(uid);
    if (out) tx.set(outboxRef, out);
    else if (outboxSnap.exists) tx.delete(outboxRef);
    void revision;
  });
}

/** 同じ outbox が10回失敗したら死信へ移し、バッチを塞がない。enqueue の set は attempts を消す。 */
async function recordListingFailure(uid: string, message: string): Promise<void> {
  const outRef = db.collection(OUTBOX).doc(uid);
  const deadRef = db.collection(DEAD).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(outRef);
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    const attempts = (typeof data.attempts === 'number' ? data.attempts : 0) + 1;
    if (attempts >= DEAD_LETTER_ATTEMPTS) {
      tx.set(deadRef, { ...data, attempts, lastError: message, failedAt: new Date().toISOString() });
      tx.delete(outRef);
      return;
    }
    tx.set(outRef, { attempts, lastError: message }, { merge: true });
  });
}

/** outbox を最大20件。ロックを取れなければ何もしない。 */
export async function runListingWorker(owner: string): Promise<{ processed: number; skippedLock: boolean }> {
  const lockRef = db.collection(META).doc('lock');
  const now = Date.now();
  const acquired = await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data();
    const lock =
      data && typeof data.untilMs === 'number' && typeof data.owner === 'string'
        ? {
            owner: data.owner,
            untilMs: data.untilMs,
            fence: typeof data.fence === 'number' ? data.fence : 0,
          }
        : null;
    const probe = emptyListingState();
    probe.lock = lock;
    const result = tryAcquireLock(probe, owner, now, LOCK_TTL_MS);
    if (!result.ok || !result.state.lock) return null;
    tx.set(lockRef, result.state.lock);
    return result.fence;
  });
  if (acquired == null) return { processed: 0, skippedLock: true };
  const fence = acquired;

  let processed = 0;
  let lastError = '';
  let leaseLost = false;
  try {
    const pending = await db.collection(OUTBOX).limit(WORKER_BATCH).get();
    for (const doc of pending.docs) {
      if (leaseLost) break;
      const uid = doc.id;
      try {
        const outcome = await db.runTransaction(async (tx) => {
          const profileRef = db.collection(PROFILES).doc(uid);
          const outRef = db.collection(OUTBOX).doc(uid);
          const tombRef = db.collection(TOMBSTONES).doc(uid);
          const tailRef = db.collection(META).doc('tail');
          const [lockSnap, profileSnap, outSnap, tombSnap, tailSnap] = await Promise.all([
            tx.get(lockRef),
            tx.get(profileRef),
            tx.get(outRef),
            tx.get(tombRef),
            tx.get(tailRef),
          ]);
          const lockData = lockSnap.data();
          const lock =
            lockData && typeof lockData.untilMs === 'number' && typeof lockData.owner === 'string'
              ? {
                  owner: lockData.owner,
                  untilMs: lockData.untilMs,
                  fence: typeof lockData.fence === 'number' ? lockData.fence : 0,
                }
              : null;
          if (!lockAllowsWrite(lock, owner, fence, Date.now())) return 'lost' as const;
          const before = emptyListingState();
          const profile = profileFromDoc(uid, profileSnap.data());
          if (profile) before.profiles.set(uid, profile);
          const tombRev = tombSnap.data()?.revision;
          if (typeof tombRev === 'number') before.tombstones.set(uid, tombRev);
          const out = outSnap.data();
          if (out && typeof out.revision === 'number' && (out.op === 'upsert' || out.op === 'remove')) {
            before.outbox.set(uid, {
              uid,
              revision: out.revision,
              op: out.op,
              pageNo: typeof out.pageNo === 'number' ? out.pageNo : null,
            });
          }
          const nextSeq = tailSnap.data()?.nextSeq;
          before.nextSeq = typeof nextSeq === 'number' && nextSeq >= 1 ? nextSeq : 1;
          const decision = planSync(before, uid);
          const pageNo =
            decision.action === 'place' || decision.action === 'finish-remove' ? decision.pageNo : null;
          if (pageNo) {
            const pageSnap = await tx.get(db.collection(PAGES).doc(String(pageNo)));
            const cards = Array.isArray(pageSnap.data()?.cards) ? (pageSnap.data()?.cards as PageCard[]) : [];
            before.pages.set(pageNo, cards);
          }
          const committed = commitDecision(before, decision);
          if (!committed) return 'stale' as const;
          const live = committed.profiles.get(uid);
          if (live) tx.set(profileRef, live);
          else if (profileSnap.exists) tx.delete(profileRef);
          const tomb = committed.tombstones.get(uid);
          if (typeof tomb === 'number') tx.set(tombRef, { revision: tomb });
          else if (tombSnap.exists) tx.delete(tombRef);
          if (committed.outbox.has(uid)) {
            tx.set(outRef, committed.outbox.get(uid)!);
          } else if (outSnap.exists) {
            tx.delete(outRef);
          }
          if (committed.nextSeq !== before.nextSeq) {
            tx.set(tailRef, { nextSeq: committed.nextSeq }, { merge: true });
          }
          for (const [page, cards] of committed.pages) {
            tx.set(db.collection(PAGES).doc(String(page)), { pageNo: page, cards });
          }
          return 'ok' as const;
        });
        if (outcome === 'lost') {
          leaseLost = true;
          break;
        }
        processed += 1;
      } catch (err) {
        lastError = sanitizeHealthError(err instanceof Error ? err.message : String(err));
        console.error('listing worker item failed:', uid, err);
        await recordListingFailure(uid, lastError);
      }
    }
  } finally {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      const data = snap.data();
      if (data?.owner !== owner || data?.fence !== fence) return;
      const finishedAt = new Date().toISOString();
      const health: Record<string, unknown> = {
        lastFinishedAt: finishedAt,
        lastError,
        processed,
      };
      if (!lastError && !leaseLost) health.lastOkAt = finishedAt;
      tx.set(db.collection(META).doc('health'), health, { merge: true });
      tx.delete(lockRef);
    });
  }
  return { processed, skippedLock: false };
}

export async function readListingHealth(): Promise<ReturnType<typeof publicHealth>> {
  const snap = await db.collection(META).doc('health').get();
  return publicHealth(snap.data());
}

export type ListedCard = { uid: string; name: string; title: string; photoUrl: string };

function toCard(data: DocumentData, uid: string): ListedCard {
  return {
    uid,
    name: typeof data.name === 'string' ? data.name : '',
    title: typeof data.title === 'string' ? data.title : '',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
  };
}

async function fetchNewestUncached(limit: number): Promise<ListedCard[]> {
  const snap = await db.collection(PROFILES).orderBy('sortAtMs', 'desc').limit(limit).get();
  return snap.docs.map((doc) => toCard(doc.data(), doc.id));
}

export const getNewestListed = unstable_cache(
  async (limit: number) => fetchNewestUncached(limit),
  ['listing-newest-v1'],
  { revalidate: 60 }
);

async function fetchPhotoNewestUncached(): Promise<ListedCard[]> {
  const snap = await db
    .collection(PROFILES)
    .where('hasPhoto', '==', true)
    .orderBy('sortAtMs', 'desc')
    .limit(12)
    .get();
  return snap.docs.map((doc) => toCard(doc.data(), doc.id));
}

export const getPhotoNewestListed = unstable_cache(
  async () => fetchPhotoNewestUncached(),
  ['listing-photo-newest-v1'],
  { revalidate: 60 }
);

export async function getFixedPage(pageNo: number): Promise<PageCard[]> {
  const snap = await db.collection(PAGES).doc(String(pageNo)).get();
  const cards = snap.data()?.cards;
  return Array.isArray(cards) ? (cards as PageCard[]) : [];
}

export const getCachedFixedPage = unstable_cache(
  async (pageNo: number) => getFixedPage(pageNo),
  ['listing-fixed-page-v1'],
  { revalidate: 60 }
);

export async function getListingPageCount(): Promise<number> {
  const snap = await db.collection(META).doc('tail').get();
  const nextSeq = snap.data()?.nextSeq;
  return pageCountFromNextSeq(typeof nextSeq === 'number' ? nextSeq : 1);
}

export const getCachedListingPageCount = unstable_cache(
  async () => getListingPageCount(),
  ['listing-page-count-v1'],
  { revalidate: 60 }
);

export async function searchListed(
  token: string,
  budget: number
): Promise<{ rows: Array<ListedCard & { searchName: string; searchTitle: string }>; truncated: boolean }> {
  const snap = await db.collection(PROFILES).where('searchTokens', 'array-contains', token).limit(budget).get();
  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      ...toCard(data, doc.id),
      searchName: typeof data.name === 'string' ? data.name : '',
      searchTitle: typeof data.title === 'string' ? data.title : '',
    };
  });
  return { rows, truncated: snap.size >= budget };
}

export async function categoryListed(slug: string): Promise<ListedCard[]> {
  const snap = await db
    .collection(PROFILES)
    .where('categorySlugs', 'array-contains', slug)
    .orderBy('sortAtMs', 'desc')
    .limit(12)
    .get();
  return snap.docs.map((doc) => toCard(doc.data(), doc.id));
}

export async function profileSeqRange(start: number, end: number): Promise<string[]> {
  const snap = await db
    .collection(PROFILES)
    .where('seq', '>=', start)
    .where('seq', '<=', end)
    .orderBy('seq', 'asc')
    .get();
  return snap.docs.map((doc) => doc.id);
}
