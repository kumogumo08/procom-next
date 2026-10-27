// app/api/oshi/[uid]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import {
  commitOshi,
  isSafeProfileUid,
  readOshiState,
  resolveOshiActor,
  visitorCookieOptions,
} from '@/lib/oshiDaily';

initializeFirebaseAdmin();

function oshiJson(body: unknown, status: number, issueVisitorId: string | null) {
  const res = NextResponse.json(body, { status });
  res.headers.set('Cache-Control', 'private, no-store');
  if (issueVisitorId) {
    const options = visitorCookieOptions();
    res.cookies.set({
      ...options,
      value: issueVisitorId,
    });
  }
  return res;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const { uid } = await context.params;
  if (!uid || !isSafeProfileUid(uid)) {
    return oshiJson({ success: false, error: 'Missing UID' }, 400, null);
  }

  let issueVisitorId: string | null = null;
  try {
    const actor = await resolveOshiActor(req);
    issueVisitorId = actor.issueVisitorId;
    const result = await commitOshi(uid, actor.actorKey);
    if (!result.ok) {
      if (result.reason === 'daily_limit') {
        return oshiJson(
          { success: false, reason: result.reason, todayCount: result.todayCount },
          429,
          issueVisitorId
        );
      }
      return oshiJson({ success: false, error: 'not_found' }, 404, issueVisitorId);
    }
    return oshiJson(
      { success: true, todayCount: result.todayCount, totalCount: result.totalCount },
      200,
      issueVisitorId
    );
  } catch (error) {
    console.error('POST oshi error:', error);
    return oshiJson({ success: false, error: 'server_error' }, 500, issueVisitorId);
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const { uid } = await context.params;
  if (!uid || !isSafeProfileUid(uid)) {
    return oshiJson({ error: 'Missing UID' }, 400, null);
  }

  let issueVisitorId: string | null = null;
  try {
    const actor = await resolveOshiActor(req);
    issueVisitorId = actor.issueVisitorId;
    const { oshiCount, todayCount } = await readOshiState(uid, actor.actorKey);
    return oshiJson(
      { oshiCount, todayCount, totalCount: oshiCount },
      200,
      issueVisitorId
    );
  } catch (error) {
    console.error('GET oshi error:', error);
    return oshiJson({ error: 'server_error' }, 500, issueVisitorId);
  }
}
