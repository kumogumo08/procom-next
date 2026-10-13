// app/api/users/route.ts — 準備完了前は上限付きの旧検索。完了後は 2-gram 候補の部分一致。
import { NextRequest, NextResponse } from 'next/server';

import { filterLegacySearch, getLegacyDirectory } from '@/lib/listing/legacyDirectory';
import { searchListed } from '@/lib/listing/firestoreListing';
import { isListingDirectoryReady } from '@/lib/listing/readiness';
import { SEARCH_READ_BUDGET, matchesSubstring, queryToken } from '@/lib/listing/searchText';
import { clientKey } from '@/lib/rateLimit';
import { allowDistributed } from '@/lib/rateLimitStore';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

function toUser(uid: string, name: string, title: string, photoUrl: string) {
  return {
    uid,
    profile: {
      name,
      title,
      photos: photoUrl ? [{ url: photoUrl }] : [],
    },
  };
}

export async function GET(req: NextRequest) {
  const qRaw = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!qRaw) {
    return NextResponse.json({ error: '検索キーワード q が必要です' }, { status: 400, headers: PRIVATE });
  }
  if (isListingDirectoryReady()) {
    const token = queryToken(qRaw);
    if (!token) {
      return NextResponse.json({ error: '2文字以上で検索してください' }, { status: 400, headers: PRIVATE });
    }
  }

  try {
    if (!(await allowDistributed(`search:${clientKey(req.headers.get('x-forwarded-for'))}`, 30, 60_000))) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。' },
        { status: 429, headers: { ...PRIVATE, 'Retry-After': '60' } }
      );
    }
    if (!isListingDirectoryReady()) {
      const rows = filterLegacySearch(await getLegacyDirectory(), qRaw);
      return NextResponse.json(
        { users: rows.map((row) => toUser(row.uid, row.name, row.title, row.photoUrl)), truncated: false },
        { headers: PRIVATE }
      );
    }
    const token = queryToken(qRaw);
    if (!token) {
      return NextResponse.json({ error: '2文字以上で検索してください' }, { status: 400, headers: PRIVATE });
    }
    const found = await searchListed(token, SEARCH_READ_BUDGET);
    const users = found.rows
      .filter((row) => matchesSubstring(row.searchName, row.searchTitle, qRaw))
      .map((row) => toUser(row.uid, row.name, row.title, row.photoUrl));
    return NextResponse.json({ users, truncated: found.truncated }, { headers: PRIVATE });
  } catch (error) {
    console.error('ユーザー検索エラー:', error);
    return NextResponse.json({ error: 'ユーザー情報の取得に失敗しました' }, { status: 500, headers: PRIVATE });
  }
}
