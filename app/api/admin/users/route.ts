// GET /api/admin/users — 新規登録者一覧（管理者のみ）
import { NextRequest, NextResponse } from 'next/server';
import { readSuspensionReason, readUserSuspended } from '@/lib/accountSuspension';
import { db } from '@/lib/firebase-admin';
import { authUnavailableResponse } from '@/lib/activeSession';
import { getLoggedInUid } from '@/lib/session';
import { isAdmin } from '@/lib/isAdmin';
import { isAdminTargetUid } from '@/lib/spotlightModeration';
import { readUserSpotlightOff } from '@/lib/spotlightModeration';

export const runtime = 'nodejs';

type FirestoreTimestampLike = {
  toDate: () => Date;
};

function toISO(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (
    typeof v === 'object' &&
    v !== null &&
    'toDate' in v &&
    typeof (v as FirestoreTimestampLike).toDate === 'function'
  ) {
    try {
      return (v as FirestoreTimestampLike).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function resolveFirstPhotoUrl(photos: unknown): string {
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const raw = photos[0];
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object' && 'url' in raw) {
    const u = (raw as { url?: unknown }).url;
    return typeof u === 'string' ? u.trim() : '';
  }
  return '';
}

function countRegisteredLinks(profile: Record<string, unknown>): number {
  let count = 0;
  if (Array.isArray(profile.customLinks)) count += profile.customLinks.length;
  if (Array.isArray(profile.bannerLinks)) count += profile.bannerLinks.length;
  if (Array.isArray(profile.tiktokUrls)) count += profile.tiktokUrls.length;
  if (typeof profile.youtubeChannelId === 'string' && profile.youtubeChannelId.trim()) count += 1;
  if (typeof profile.instagramPostUrl === 'string' && profile.instagramPostUrl.trim()) count += 1;
  if (typeof profile.xUsername === 'string' && profile.xUsername.trim()) count += 1;
  if (typeof profile.facebookUrl === 'string' && profile.facebookUrl.trim()) count += 1;
  return count;
}

function toAdminRow(doc: { id: string; data: () => unknown }) {
  const raw = doc.data();
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const profile =
    data.profile && typeof data.profile === 'object' ? (data.profile as Record<string, unknown>) : {};
  const photoUrl = resolveFirstPhotoUrl(profile.photos);
  const bio = typeof profile.bio === 'string' ? profile.bio.trim() : '';
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const title = typeof profile.title === 'string' ? profile.title.trim() : '';
  return {
    uid: doc.id,
    name,
    title,
    createdAt: toISO(data.createdAt),
    photoUrl: photoUrl || null,
    hasPhoto: Boolean(photoUrl),
    hasBio: Boolean(bio),
    linkCount: countRegisteredLinks(profile),
    isPublic: profile.isPublic !== false,
    spotlightOff: readUserSpotlightOff(data),
    suspended: readUserSuspended(data),
    suspensionReason: readSuspensionReason(data),
    canSuspend: !isAdmin(doc.id),
    listingPending: false,
  };
}

async function markListingPending<T extends { uid: string }>(rows: T[]): Promise<Array<T & { listingPending: boolean }>> {
  if (rows.length === 0) return [];
  const pending = new Set<string>();
  for (let index = 0; index < rows.length; index += 10) {
    const slice = rows.slice(index, index + 10);
    const snaps = await db.getAll(...slice.map((row) => db.collection('listingOutbox').doc(row.uid)));
    for (const snap of snaps) {
      if (snap.exists) pending.add(snap.id);
    }
  }
  return rows.map((row) => ({ ...row, listingPending: pending.has(row.uid) }));
}

export async function GET(req: NextRequest) {
  let uid: string | null;
  try {
    uid = await getLoggedInUid();
  } catch (err: unknown) {
    const unavailable = authUnavailableResponse(err);
    if (unavailable) return unavailable;
    throw err;
  }
  if (!isAdmin(uid ?? undefined)) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  try {
    const lookup = new URL(req.url).searchParams.get('uid')?.trim() ?? '';
    if (lookup) {
      if (!isAdminTargetUid(lookup)) {
        return NextResponse.json({ error: 'bad-request' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
      }
      const doc = await db.collection('users').doc(lookup).get();
      if (!doc.exists) {
        return NextResponse.json({ error: 'not-found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
      }
      const users = await markListingPending([toAdminRow(doc)]);
      return NextResponse.json(
        { users, lookup: true },
        { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const snap = await db
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const users = snap.docs.map((doc) => toAdminRow(doc));

    // createdAt なしは末尾（通常は orderBy 対象外だが、念のため安定化）
    users.sort((a, b) => {
      if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
      if (a.createdAt && !b.createdAt) return -1;
      if (!a.createdAt && b.createdAt) return 1;
      return 0;
    });

    return NextResponse.json(
      { users: await markListingPending(users) },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
