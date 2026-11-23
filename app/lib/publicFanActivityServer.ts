import 'server-only';

import { db } from '@/lib/firebase-admin';
import { canShowPublicFanActivity } from '@/lib/fanActivityVisibility';
import {
  MYPAGE_LIST_LIMIT,
  readOwnSupportLink,
  visibleCreatorCard,
  type MypageSupportCard,
} from '@/lib/mypageActivity';
import { SUPPORT_LINKS_COLLECTION } from '@/lib/oshiDaily';

const TARGET_FIELDS = [
  'deletionPending',
  'moderation.suspended',
  'profile.name',
  'profile.photos',
  'profile.isPublic',
  'profile.onboardingStatus',
] as const;

export type PublicFanActivity = {
  supports: MypageSupportCard[];
  truncated: boolean;
  error: boolean;
};

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
  }
  return null;
}

/** 公開判定のあとだけ、本人が応援した公開中の相手を最大50件読む。 */
export async function loadPublicFanActivity(uid: string): Promise<PublicFanActivity | null> {
  const owner = await db.collection('users').doc(uid).get();
  if (!canShowPublicFanActivity(owner.data())) return null;
  try {
    const snap = await db
      .collection(SUPPORT_LINKS_COLLECTION)
      .where('fanUid', '==', uid)
      .orderBy('lastAt', 'desc')
      .limit(MYPAGE_LIST_LIMIT)
      .get();
    const links = snap.docs.flatMap((doc) => {
      const data = doc.data();
      const link = readOwnSupportLink(uid, {
        fanUid: data.fanUid,
        creatorUid: data.creatorUid,
        count: data.count,
      });
      return link ? [{ ...link, lastAt: toDate(data.lastAt) }] : [];
    });
    const cards = new Map<string, MypageSupportCard>();
    for (let index = 0; index < links.length; index += 10) {
      const chunk = links.slice(index, index + 10);
      const snaps = await db.getAll(
        ...chunk.map((link) => db.collection('users').doc(link.creatorUid)),
        { fieldMask: [...TARGET_FIELDS] }
      );
      snaps.forEach((target, targetIndex) => {
        const link = chunk[targetIndex];
        const card = visibleCreatorCard(target.id, target.data());
        if (!card || !link) return;
        cards.set(link.creatorUid, { ...card, count: link.count, lastAt: link.lastAt });
      });
    }
    const supports = links.flatMap((link) => {
      const card = cards.get(link.creatorUid);
      return card ? [card] : [];
    });
    return { supports, truncated: snap.size === MYPAGE_LIST_LIMIT, error: false };
  } catch (err: unknown) {
    console.error('public fan activity', err instanceof Error ? err.name : 'error');
    return { supports: [], truncated: false, error: true };
  }
}
