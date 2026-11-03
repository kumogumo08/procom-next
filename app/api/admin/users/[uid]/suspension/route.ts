// POST /api/admin/users/[uid]/suspension — アカウント停止・解除（管理者のみ）
import { NextRequest, NextResponse } from 'next/server';

import { decideAdminSuspension, suspensionFieldUpdate } from '@/lib/accountSuspension';
import { authUnavailableResponse } from '@/lib/activeSession';
import { db, FieldValue } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/isAdmin';
import {
  enqueueUserListing,
  listingOutboxPending,
  runListingWorker,
} from '@/lib/listing/firestoreListing';
import { invalidateListingAfterUnpublish, invalidateListingPages } from '@/lib/listing/listingCache';
import { getLoggedInUid } from '@/lib/session';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function POST(
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

  const decision = decideAdminSuspension({
    isAdmin: isAdmin(actor ?? undefined),
    origin: req.headers.get('origin'),
    dev: process.env.NODE_ENV !== 'production',
    actorUid: actor ?? '',
    uid,
    body,
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status, headers: PRIVATE });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return 'missing' as const;
      if (snap.get('deletionPending') === true) return 'deleting' as const;
      const fields = decision.suspended
        ? {
            ...suspensionFieldUpdate({
              suspended: true,
              reason: decision.reason,
              actorUid: actor ?? '',
            }),
            'moderation.suspendedAt': FieldValue.serverTimestamp(),
          }
        : suspensionFieldUpdate({ suspended: false });
      tx.update(userRef, fields);
      return 'ok' as const;
    });
    if (outcome === 'missing') {
      return NextResponse.json({ error: 'not-found' }, { status: 404, headers: PRIVATE });
    }
    if (outcome === 'deleting') {
      return NextResponse.json({ error: 'deleting' }, { status: 409, headers: PRIVATE });
    }

    try {
      await enqueueUserListing(uid);
    } catch (err: unknown) {
      console.error('suspension listing enqueue failed:', err instanceof Error ? err.name : 'error');
      return NextResponse.json(
        { error: 'sync-failed', suspended: decision.suspended, listingPending: true },
        { status: 500, headers: PRIVATE }
      );
    }

    invalidateListingAfterUnpublish();
    let listingPending = true;
    try {
      const worker = await runListingWorker(`suspend:${uid}`);
      listingPending = worker.skippedLock || (await listingOutboxPending(uid));
      if (!listingPending) invalidateListingPages();
    } catch (err: unknown) {
      console.error('suspension listing worker failed:', err instanceof Error ? err.name : 'error');
      listingPending = true;
    }

    return NextResponse.json(
      { ok: true, suspended: decision.suspended, listingPending },
      { status: 200, headers: PRIVATE }
    );
  } catch (error) {
    console.error('POST suspension error:', error instanceof Error ? error.name : 'error');
    return NextResponse.json({ error: 'update-failed' }, { status: 500, headers: PRIVATE });
  }
}
