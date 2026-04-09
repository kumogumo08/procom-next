import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';

import LoginClient from '@/login/LoginClient';
import { getLoggedInUid } from '@/lib/session';

/** Cookie を読むため静的化しない（RSC でセッションと一致させる） */
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  noStore();
  const uid = await getLoggedInUid();
  if (uid) {
    redirect(`/user/${uid}`);
  }

  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <LoginClient initialMode="register" />
    </Suspense>
  );
}
