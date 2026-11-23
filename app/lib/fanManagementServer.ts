import 'server-only';

import { bucket, db } from '@/lib/firebase-admin';
import {
  FAN_MANAGEMENT_LIMIT,
  SUPPORTER_FIELDS,
  buildSupporterCard,
  readCreatorSupportLink,
  type FanManagementCard,
} from '@/lib/fanManagement';
import { SUPPORT_LINKS_COLLECTION } from '@/lib/oshiDaily';

export type FanManagementResult = {
  supporters: FanManagementCard[];
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

async function loadSupporterNames(ids: string[]): Promise<Map<string, unknown>> {
  const users = new Map<string, unknown>();
  for (let index = 0; index < ids.length; index += 10) {
    const chunk = ids.slice(index, index + 10);
    const snaps = await db.getAll(
      ...chunk.map((id) => db.collection('users').doc(id)),
      { fieldMask: [...SUPPORTER_FIELDS] }
    );
    for (const snap of snaps) {
      if (!snap.exists) continue;
      users.set(snap.id, snap.data());
    }
  }
  return users;
}

/** セッション UID が creatorUid の応援だけを読む。 */
export async function loadFanManagement(ownerUid: string): Promise<FanManagementResult> {
  try {
    const snap = await db
      .collection(SUPPORT_LINKS_COLLECTION)
      .where('creatorUid', '==', ownerUid)
      .orderBy('lastAt', 'desc')
      .limit(FAN_MANAGEMENT_LIMIT)
      .get();
    const links = snap.docs.flatMap((doc) => {
      const data = doc.data();
      const link = readCreatorSupportLink(ownerUid, {
        fanUid: data.fanUid,
        creatorUid: data.creatorUid,
        count: data.count,
      });
      if (!link) return [];
      return [{ ...link, firstAt: toDate(data.firstAt), lastAt: toDate(data.lastAt) }];
    });
    const users = await loadSupporterNames(links.map((link) => link.fanUid));
    const supporters = links.flatMap((link) => {
      const card = buildSupporterCard(
        ownerUid,
        { fanUid: link.fanUid, creatorUid: ownerUid, count: link.count },
        users.get(link.fanUid) ?? null,
        { firstAt: link.firstAt, lastAt: link.lastAt },
        bucket.name
      );
      return card ? [card] : [];
    });
    return { supporters, truncated: snap.size === FAN_MANAGEMENT_LIMIT, error: false };
  } catch (err: unknown) {
    console.error('fan management', err instanceof Error ? err.name : 'error');
    return { supporters: [], truncated: false, error: true };
  }
}
