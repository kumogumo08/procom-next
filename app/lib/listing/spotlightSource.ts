import 'server-only';

import { unstable_cache } from 'next/cache';

import type { DocumentData } from 'firebase-admin/firestore';

import { db } from '@/lib/firebase-admin';
import { positiveMillis } from '@/lib/profileContent';

import { readLegacyDirectory } from './legacyDirectory';
import { LISTING_CACHE_TAG } from './listingCache';
import { isListingDirectoryReady } from './readiness';
import {
  SPOTLIGHT_SOURCE_MAX,
  SPOTLIGHT_SOURCE_REVALIDATE_SECONDS,
  toSpotlightCandidate,
  type SpotlightCandidate,
} from './spotlight';

const PROFILES = 'publicProfiles';

function listedCandidate(uid: string, data: DocumentData): SpotlightCandidate | null {
  const sortAtMs = typeof data.sortAtMs === 'number' ? data.sortAtMs : 0;
  return toSpotlightCandidate({
    uid,
    name: typeof data.name === 'string' ? data.name : '',
    title: typeof data.title === 'string' ? data.title : '',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    createdAtMs: data.missingCreatedAt === true ? null : positiveMillis(sortAtMs),
    contentUpdatedAtMs: positiveMillis(data.contentUpdatedAtMs),
    isPublic: true,
  });
}

async function readListedSpotlightSource(): Promise<SpotlightCandidate[]> {
  const snap = await db.collection(PROFILES).where('hasPhoto', '==', true).limit(SPOTLIGHT_SOURCE_MAX).get();
  if (snap.size >= SPOTLIGHT_SOURCE_MAX) {
    console.warn(
      `spotlight source reached ${SPOTLIGHT_SOURCE_MAX}. Switch to banded queries before the photo-public set grows further.`
    );
  }
  const candidates: SpotlightCandidate[] = [];
  for (const doc of snap.docs) {
    const candidate = listedCandidate(doc.id, doc.data());
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

export async function readLegacySpotlightSource(): Promise<SpotlightCandidate[]> {
  const rows = await readLegacyDirectory();
  const candidates: SpotlightCandidate[] = [];
  for (const row of rows) {
    const candidate = toSpotlightCandidate({
      uid: row.uid,
      name: row.name,
      title: row.title,
      photoUrl: row.photoUrl,
      createdAtMs: positiveMillis(row.createdAtMs),
      contentUpdatedAtMs: positiveMillis(row.contentUpdatedAtMs),
      isPublic: true,
    });
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

const getListedSpotlightSource = unstable_cache(readListedSpotlightSource, ['spotlight-source-listed-v1'], {
  revalidate: SPOTLIGHT_SOURCE_REVALIDATE_SECONDS,
  tags: [LISTING_CACHE_TAG],
});

const getLegacySpotlightSource = unstable_cache(readLegacySpotlightSource, ['spotlight-source-legacy-v1'], {
  revalidate: SPOTLIGHT_SOURCE_REVALIDATE_SECONDS,
  tags: [LISTING_CACHE_TAG],
});

/** 画像ありの公開プロフィール。ページ表示のたびに Firestore は読まない。 */
export async function getSpotlightSource(): Promise<SpotlightCandidate[]> {
  if (!isListingDirectoryReady()) return getLegacySpotlightSource();
  return getListedSpotlightSource();
}
