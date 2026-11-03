import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthPageShell from '@/components/AuthPageShell';
import { ACCOUNT_SUSPENDED_PATH, readUserSuspended } from '@/lib/accountSuspension';
import { bucket, db } from '@/lib/firebase';
import { readOnboardingGate } from '@/lib/onboarding';
import { parseOwnedSetupPhoto, setupFormInitial } from '@/lib/onboardingSetup';
import { isAuthUnavailable } from '@/lib/activeSession';
import { getLoggedInUid } from '@/lib/session';
import ProfileSetupForm from './ProfileSetupForm';
import styles from './ProfileSetupForm.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'プロフィールを作成しましょう',
  robots: { index: false, follow: false },
};

export default async function ProfileSetupPage() {
  let uid: string | null = null;
  try {
    uid = await getLoggedInUid();
  } catch (err: unknown) {
    if (!isAuthUnavailable(err)) throw err;
    return (
      <>
        <AuthPageShell>
          <div className={styles.page}>
            <section className={styles.card}>
              <p className={styles.lead}>認証サービスが一時的に利用できません。時間をおいて再度お試しください。</p>
            </section>
          </div>
        </AuthPageShell>
      </>
    );
  }
  if (!uid) redirect('/login');

  const snap = await db.collection('users').doc(uid).get();
  if (readUserSuspended(snap.data())) redirect(ACCOUNT_SUSPENDED_PATH);
  const profile = snap.exists ? snap.get('profile') : undefined;
  const gate = readOnboardingGate(profile);
  const initial = setupFormInitial(profile);
  const initialPhotoOwned = parseOwnedSetupPhoto(initial.photoUrl, uid, bucket.name) !== null;

  return (
    <>
      <AuthPageShell>
      <div className={styles.page}>
        {gate === 'required' ? (
          <ProfileSetupForm
            uid={uid}
            initialName={initial.name}
            initialTitle={initial.title}
            initialPhotoUrl={initial.photoUrl}
            initialPhotoOwned={initialPhotoOwned}
          />
        ) : (
          <section className={styles.card}>
            <h1 className={styles.title}>この画面は使えません</h1>
            <p className={styles.lead}>初期設定が必要なアカウントだけが利用できます。</p>
            <p className={styles.note}>
              <Link href={`/user/${uid}`}>プロフィールへ戻る</Link>
            </p>
          </section>
        )}
      </div>
      </AuthPageShell>
    </>
  );
}
