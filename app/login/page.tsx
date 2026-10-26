// app/login/page.tsx
import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';

import LoginClient from './LoginClient';
import { db } from '@/lib/firebase';
import { profileLoginPath } from '@/lib/onboarding';
import { getLoggedInUid } from '@/lib/session';

/** Cookie を読むため静的化しない（RSC でセッションと一致させる） */
export const dynamic = 'force-dynamic';

export default async function Page() {
  noStore();
  const uid = await getLoggedInUid();
  if (uid) {
    const snap = await db.collection('users').doc(uid).get();
    const profile = snap.exists ? snap.get('profile') : undefined;
    redirect(profileLoginPath(uid, profile));
  }

  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <LoginClient />
    </Suspense>
  );
}
