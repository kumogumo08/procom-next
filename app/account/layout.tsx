import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ACCOUNT_SUSPENDED_PATH, readUserSuspended } from '@/lib/accountSuspension';
import { isAuthUnavailable } from '@/lib/activeSession';
import { db } from '@/lib/firebase-admin';
import { getLoggedInUid } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const path = (await headers()).get('x-procom-path') ?? '';
  if (!path || path === ACCOUNT_SUSPENDED_PATH || path.startsWith(`${ACCOUNT_SUSPENDED_PATH}/`)) {
    return children;
  }

  let uid: string | null = null;
  try {
    uid = await getLoggedInUid();
  } catch (err: unknown) {
    if (!isAuthUnavailable(err)) throw err;
    return children;
  }
  if (!uid) return children;

  const snap = await db.collection('users').doc(uid).get();
  if (readUserSuspended(snap.data())) redirect(ACCOUNT_SUSPENDED_PATH);
  return children;
}
