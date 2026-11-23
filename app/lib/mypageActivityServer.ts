import 'server-only';

import { db } from '@/lib/firebase-admin';
import {
  MYPAGE_LIST_LIMIT,
  readOwnSupportLink,
  selectOwnTargetIds,
  visibleCreatorCard,
  type MypageCreatorCard,
  type MypageSupportCard,
} from '@/lib/mypageActivity';
import { SUPPORT_LINKS_COLLECTION } from '@/lib/oshiDaily';

export type MypageActivity = {
  favorites: MypageCreatorCard[];
  favoritesTruncated: boolean;
  favoriteError: boolean;
  supports: MypageSupportCard[];
  supportsTruncated: boolean;
  supportError: boolean;
};

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
  }
  return null;
}

async function loadVisibleCreators(ids: string[]): Promise<Map<string, MypageCreatorCard>> {
  const cards = new Map<string, MypageCreatorCard>();
  for (let index = 0; index < ids.length; index += 10) {
    const chunk = ids.slice(index, index + 10);
    const snaps = await db.getAll(...chunk.map((id) => db.collection('users').doc(id)));
    for (const snap of snaps) {
      const card = visibleCreatorCard(snap.id, snap.data());
      if (card) cards.set(snap.id, card);
    }
  }
  return cards;
}

async function loadFavorites(ownerUid: string, favoritesField: unknown): Promise<Pick<MypageActivity, 'favorites' | 'favoritesTruncated' | 'favoriteError'>> {
  const selected = selectOwnTargetIds(ownerUid, favoritesField);
  try {
    const visible = await loadVisibleCreators(selected.ids);
    return {
      favorites: selected.ids.flatMap((id) => {
        const card = visible.get(id);
        return card ? [card] : [];
      }),
      favoritesTruncated: selected.truncated,
      favoriteError: false,
    };
  } catch (err: unknown) {
    console.error('mypage favorites', err instanceof Error ? err.name : 'error');
    return { favorites: [], favoritesTruncated: false, favoriteError: true };
  }
}

async function loadSupports(ownerUid: string): Promise<Pick<MypageActivity, 'supports' | 'supportsTruncated' | 'supportError'>> {
  try {
    const snap = await db
      .collection(SUPPORT_LINKS_COLLECTION)
      .where('fanUid', '==', ownerUid)
      .orderBy('lastAt', 'desc')
      .limit(MYPAGE_LIST_LIMIT)
      .get();
    const links = snap.docs.flatMap((doc) => {
      const data = doc.data();
      const link = readOwnSupportLink(ownerUid, {
        fanUid: data.fanUid,
        creatorUid: data.creatorUid,
        count: data.count,
      });
      return link ? [{ ...link, lastAt: toDate(data.lastAt) }] : [];
    });
    const visible = await loadVisibleCreators(links.map((link) => link.creatorUid));
    const supports = links.flatMap((link) => {
      const card = visible.get(link.creatorUid);
      if (!card) return [];
      return [{ ...card, count: link.count, lastAt: link.lastAt }];
    });
    return { supports, supportsTruncated: snap.size === MYPAGE_LIST_LIMIT, supportError: false };
  } catch (err: unknown) {
    console.error('mypage supports', err instanceof Error ? err.name : 'error');
    return { supports: [], supportsTruncated: false, supportError: true };
  }
}

/** セッション UID の文書と、その UID が fanUid の応援だけを読む。 */
export async function loadMypageActivity(ownerUid: string, favoritesField: unknown): Promise<MypageActivity> {
  const [favorites, supports] = await Promise.all([
    loadFavorites(ownerUid, favoritesField),
    loadSupports(ownerUid),
  ]);
  return { ...favorites, ...supports };
}
