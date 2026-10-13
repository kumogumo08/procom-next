import { NextRequest, NextResponse } from 'next/server';

import { readListingHealth, runListingWorker } from '@/lib/listing/firestoreListing';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

function authorized(req: NextRequest): boolean {
  const secret = process.env.LISTING_SYNC_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!process.env.LISTING_SYNC_SECRET) {
    return NextResponse.json({ error: 'LISTING_SYNC_SECRET が未設定です' }, { status: 503, headers: PRIVATE });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: PRIVATE });
  }
  const health = await readListingHealth();
  return NextResponse.json(health, { headers: PRIVATE });
}

export async function POST(req: NextRequest) {
  if (!process.env.LISTING_SYNC_SECRET) {
    return NextResponse.json({ error: 'LISTING_SYNC_SECRET が未設定です' }, { status: 503, headers: PRIVATE });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: PRIVATE });
  }
  const result = await runListingWorker(`cron-${Date.now()}`);
  const health = await readListingHealth();
  return NextResponse.json({ processed: result.processed, skippedLock: result.skippedLock, health }, { headers: PRIVATE });
}
