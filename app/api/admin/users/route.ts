// GET /api/admin/users — 新規登録者一覧（管理者のみ）
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSessionServer } from '@/lib/session';
import { isAdmin } from '@/lib/isAdmin';

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

export async function GET() {
  const session = await getSessionServer();
  if (!isAdmin(session?.uid)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
  }

  try {
    const snap = await db
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const users = snap.docs.map((doc) => {
      const data = doc.data();
      const profile =
        data.profile && typeof data.profile === 'object'
          ? (data.profile as Record<string, unknown>)
          : {};

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
        // metadata.ts と同様: 未設定は公開扱い
        isPublic: profile.isPublic !== false,
      };
    });

    // createdAt なしは末尾（通常は orderBy 対象外だが、念のため安定化）
    users.sort((a, b) => {
      if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
      if (a.createdAt && !b.createdAt) return -1;
      if (!a.createdAt && b.createdAt) return 1;
      return 0;
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
