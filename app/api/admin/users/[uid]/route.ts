// PATCH /api/admin/users/[uid] — Spotlight 掲載フラグ（管理者のみ）
import { NextRequest, NextResponse } from 'next/server';
import { db, FieldValue } from '@/lib/firebase-admin';
import { authUnavailableResponse } from '@/lib/activeSession';
import { invalidateListingAfterSpotlightChange } from '@/lib/listing/listingCache';
import { getLoggedInUid } from '@/lib/session';
import { isAdmin } from '@/lib/isAdmin';
import { decideAdminSpotlightPatch } from '@/lib/spotlightModeration';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  let actor: string | null;
  try {
    actor = await getLoggedInUid();
  } catch (err: unknown) {
    const unavailable = authUnavailableResponse(err);
    if (unavailable) return unavailable;
    throw err;
  }

  const { uid } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  const decision = decideAdminSpotlightPatch({
    isAdmin: isAdmin(actor ?? undefined),
    origin: req.headers.get('origin'),
    dev: process.env.NODE_ENV !== 'production',
    uid,
    body,
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status, headers: PRIVATE });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const profileRef = db.collection('publicProfiles').doc(uid);
    const found = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return false;
      const profileSnap = await tx.get(profileRef);
      tx.update(userRef, { 'moderation.spotlightOff': decision.spotlightOff });
      if (profileSnap.exists) {
        if (decision.spotlightOff) {
          tx.update(profileRef, { spotlightOff: true });
        } else if (profileSnap.get('spotlightOff') !== undefined) {
          tx.update(profileRef, { spotlightOff: FieldValue.delete() });
        }
      }
      return true;
    });
    if (!found) {
      return NextResponse.json({ error: 'not-found' }, { status: 404, headers: PRIVATE });
    }
    invalidateListingAfterSpotlightChange();
    return NextResponse.json(
      { ok: true, spotlightOff: decision.spotlightOff },
      { status: 200, headers: PRIVATE }
    );
  } catch (error) {
    console.error('PATCH /api/admin/users/[uid] error:', error instanceof Error ? error.name : 'error');
    return NextResponse.json({ error: 'update-failed' }, { status: 500, headers: PRIVATE });
  }
}
