import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';

import LoginClient from '@/login/LoginClient';
import { ACCOUNT_SUSPENDED_PATH, readUserSuspended } from '@/lib/accountSuspension';
import { db } from '@/lib/firebase';
import { isAuthUnavailable } from '@/lib/activeSession';
import { getLoggedInUid } from '@/lib/session';

/** Cookie を読むため静的化しない（RSC でセッションと一致させる） */
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  noStore();
  let uid: string | null = null;
  try {
    uid = await getLoggedInUid();
  } catch (err: unknown) {
    if (!isAuthUnavailable(err)) throw err;
  }
  if (uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (readUserSuspended(snap.data())) redirect(ACCOUNT_SUSPENDED_PATH);
    redirect(`/user/${uid}`);
  }

  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <LoginClient initialMode="register" />
    </Suspense>
  );
}
