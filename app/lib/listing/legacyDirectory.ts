import 'server-only';

import { unstable_cache } from 'next/cache';

import { db } from '@/lib/firebase-admin';
import { positiveMillis } from '@/lib/profileContent';
import { compareDirectoryOrder, createdAtToMillis } from '@/lib/publicUserDirectory';
import { isProfilePublicWithOnboarding } from '@/lib/onboarding';

import { LISTING_CACHE_TAG } from './listingCache';
import { assertLegacyScanAllowed } from './readiness';
import { normalizeSearchText } from './searchText';

export type LegacyListUser = {
  uid: string;
  name: string;
  title: string;
  photoUrl: string;
  createdAtMs: number | null;
  contentUpdatedAtMs: number | null;
};

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

export async function readLegacyDirectory(): Promise<LegacyListUser[]> {
  const counted = await db.collection('users').count().get();
  const total = counted.data().count;
  assertLegacyScanAllowed(total);
  const snap = await db
    .collection('users')
    .select(
      'createdAt',
      'deletionPending',
      'profile.isPublic',
      'profile.onboardingStatus',
      'profile.name',
      'profile.title',
      'profile.photos',
      'profile.contentUpdatedAtMs'
    )
    .get();
  const rows: LegacyListUser[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const profile =
      data.profile && typeof data.profile === 'object' ? (data.profile as Record<string, unknown>) : {};
    if (data.deletionPending === true) continue;
    if (!isProfilePublicWithOnboarding(profile)) continue;
    rows.push({
      uid: doc.id,
      name: typeof profile.name === 'string' ? profile.name : '',
      title: typeof profile.title === 'string' ? profile.title : '',
      photoUrl: photoUrlOf(profile),
      createdAtMs: createdAtToMillis(data.createdAt),
      contentUpdatedAtMs: positiveMillis(profile.contentUpdatedAtMs),
    });
  }
  rows.sort((a, b) => compareDirectoryOrder(a, b));
  return rows;
}

/** 移行完了前だけ使う。500人を超えたら拒否する。 */
export const getLegacyDirectory = unstable_cache(readLegacyDirectory, ['legacy-directory-v3'], {
  revalidate: 60,
  tags: [LISTING_CACHE_TAG],
});

/** 旧検索。1文字も部分一致の対象。全件は getLegacyDirectory の上限内だけ。 */
export function filterLegacySearch(rows: readonly LegacyListUser[], q: string): LegacyListUser[] {
  const needle = normalizeSearchText(q);
  if (!needle) return [];
  return rows.filter((row) => {
    const name = normalizeSearchText(row.name);
    const title = normalizeSearchText(row.title);
    const combined = normalizeSearchText(`${row.name} ${row.title}`);
    return name.includes(needle) || title.includes(needle) || combined.includes(needle);
  });
}
