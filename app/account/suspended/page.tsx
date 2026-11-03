import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import AuthPageShell from '@/components/AuthPageShell';
import { readUserSuspended } from '@/lib/accountSuspension';
import { isAuthUnavailable } from '@/lib/activeSession';
import { db } from '@/lib/firebase-admin';
import { profileLoginPath } from '@/lib/onboarding';
import { getLoggedInUid } from '@/lib/session';

import SuspendedAccountActions from './SuspendedAccountActions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'アカウントが停止されています',
  robots: { index: false, follow: false },
};

export default async function SuspendedAccountPage() {
  let uid: string | null = null;
  try {
    uid = await getLoggedInUid();
  } catch (err: unknown) {
    if (!isAuthUnavailable(err)) throw err;
    return (
      <>
        <AuthPageShell>
          <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <p className="text-sm text-neutral-700">認証サービスが一時的に利用できません。時間をおいて再度お試しください。</p>
          </section>
        </AuthPageShell>
      </>
    );
  }
  if (!uid) redirect('/login');

  const snap = await db.collection('users').doc(uid).get();
  if (!readUserSuspended(snap.data())) {
    redirect(profileLoginPath(uid, snap.get('profile')));
  }

  return (
    <>
      <AuthPageShell>
      <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold text-neutral-900">アカウントが停止されています</h1>
        <p className="mt-4 text-sm leading-6 text-neutral-700">
          このアカウントは、Procomの利用規約に基づき停止されています。
        </p>
        <p className="mt-3 text-sm leading-6 text-neutral-700">
          停止中はプロフィールの公開・編集、および各種サービスをご利用いただけません。
        </p>
        <p className="mt-6">
          <Link href="/help" className="inline-flex min-h-11 items-center text-sm text-blue-600 underline hover:text-blue-800">
            お問い合わせ
          </Link>
        </p>
        <SuspendedAccountActions />
      </section>
      </AuthPageShell>
    </>
  );
}
