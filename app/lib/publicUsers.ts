import 'server-only';

import { unstable_cache } from 'next/cache';

import { db } from '@/lib/firebase-admin';
import { isProfilePublic, slimProfileForList } from '@/lib/userSeo';

export type PublicListUser = {
  uid: string;
  profile: ReturnType<typeof slimProfileForList>;
};

/** 新着一覧。createdAt の単一 orderBy のみ（複合 index 不要）。非公開はメモリ上で除外。 */
const RECENT_FETCH_LIMIT = 40;
const RECENT_PUBLIC_LIMIT = 20;

async function fetchRecentPublicUsers(): Promise<PublicListUser[]> {
  const snapshot = await db
    .collection('users')
    .orderBy('createdAt', 'desc')
    .limit(RECENT_FETCH_LIMIT)
    .get();

  const users: PublicListUser[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const profileRaw =
      data.profile && typeof data.profile === 'object'
        ? (data.profile as Record<string, unknown>)
        : {};
    if (!isProfilePublic(profileRaw)) continue;
    users.push({ uid: doc.id, profile: slimProfileForList(profileRaw) });
    if (users.length >= RECENT_PUBLIC_LIMIT) break;
  }
  return users;
}

export const getRecentPublicUsers = unstable_cache(
  async (): Promise<PublicListUser[]> => {
    try {
      return await fetchRecentPublicUsers();
    } catch (err) {
      console.error('getRecentPublicUsers failed:', err);
      return [];
    }
  },
  ['recent-public-users-v1'],
  { revalidate: 300 }
);

async function fetchPublicUserUids(): Promise<string[]> {
  const snapshot = await db.collection('users').select('profile.isPublic').get();
  const uids: string[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const profileRaw =
      data?.profile && typeof data.profile === 'object'
        ? (data.profile as Record<string, unknown>)
        : {};
    if (!isProfilePublic(profileRaw)) continue;
    uids.push(doc.id);
  }
  return uids;
}

export const getPublicUserUidsForSitemap = unstable_cache(
  async (): Promise<string[]> => {
    try {
      return await fetchPublicUserUids();
    } catch (err) {
      console.error('getPublicUserUidsForSitemap failed:', err);
      return [];
    }
  },
  ['sitemap-public-user-uids-v1'],
  { revalidate: 3600 }
);
