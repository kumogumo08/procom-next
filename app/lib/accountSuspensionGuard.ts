import 'server-only';

import { NextResponse } from 'next/server';

import { db } from '@/lib/firebase-admin';

import { readUserSuspended } from '@/lib/accountSuspension';

export const SUSPENDED_WRITE_MESSAGE = 'このアカウントは停止されています';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

export function suspendedWriteResponse(): NextResponse {
  return NextResponse.json({ error: SUSPENDED_WRITE_MESSAGE }, { status: 403, headers: PRIVATE });
}

/** 認証済みの通常操作。退会 API からは呼ばない。 */
export async function rejectIfSuspended(uid: string): Promise<NextResponse | null> {
  const snap = await db.collection('users').doc(uid).get();
  if (readUserSuspended(snap.data())) return suspendedWriteResponse();
  return null;
}
