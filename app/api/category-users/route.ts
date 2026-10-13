// /api/category-users/route.ts — 準備完了前は上限付きの旧一覧。完了後は publicProfiles の上限読み。

import { NextRequest, NextResponse } from 'next/server';

import { categoryListed, getNewestListed, getPhotoNewestListed } from '@/lib/listing/firestoreListing';
import { getLegacyDirectory } from '@/lib/listing/legacyDirectory';
import { isListingDirectoryReady } from '@/lib/listing/readiness';
import { CATEGORY_LABELS, categorySlugsForTitle } from '@/lib/listing/searchText';
import { clientKey } from '@/lib/rateLimit';
import { allowDistributed } from '@/lib/rateLimitStore';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

function toRow(card: { uid: string; name: string; title: string; photoUrl: string }) {
  return {
    uid: card.uid,
    profile: {
      name: card.name,
      title: card.title,
      photos: card.photoUrl ? [{ url: card.photoUrl }] : [],
    },
  };
}

export async function GET(req: NextRequest) {
  if (!(await allowDistributed(`category:${clientKey(req.headers.get('x-forwarded-for'))}`, 60, 60_000))) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。' },
      { status: 429, headers: { ...PRIVATE, 'Retry-After': '60' } }
    );
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const withPhotos = searchParams.get('withPhotos') === '1';

  try {
    if (!isListingDirectoryReady()) {
      const rows = await getLegacyDirectory();
      let picked = rows;
      if (category !== 'new') {
        if (!CATEGORY_LABELS.includes(category as (typeof CATEGORY_LABELS)[number])) {
          return NextResponse.json({ users: [] }, { headers: PRIVATE });
        }
        picked = rows.filter((row) => categorySlugsForTitle(row.title).includes(category));
      }
      if (withPhotos) picked = picked.filter((row) => row.photoUrl.length > 0);
      return NextResponse.json({ users: picked.slice(0, 12).map(toRow) }, { headers: PRIVATE });
    }
    if (category === 'new' && withPhotos) {
      const cards = await getPhotoNewestListed();
      return NextResponse.json({ users: cards.map(toRow) }, { headers: PRIVATE });
    }
    if (category === 'new') {
      const cards = await getNewestListed(12);
      return NextResponse.json({ users: cards.map(toRow) }, { headers: PRIVATE });
    }
    if (!CATEGORY_LABELS.includes(category as (typeof CATEGORY_LABELS)[number])) {
      return NextResponse.json({ users: [] }, { headers: PRIVATE });
    }
    const cards = await categoryListed(category);
    const rows = cards.map(toRow).filter((row) => (withPhotos ? row.profile.photos.length > 0 : true));
    return NextResponse.json({ users: rows }, { headers: PRIVATE });
  } catch (error) {
    console.error('category-users エラー:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500, headers: PRIVATE });
  }
}
