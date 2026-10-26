import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { bucket, db } from '@/lib/firebase';
import { readOnboardingGate } from '@/lib/onboarding';
import { parseOwnedSetupPhoto, setupFormInitial } from '@/lib/onboardingSetup';
import { getLoggedInUid } from '@/lib/session';
import ProfileSetupForm from './ProfileSetupForm';
import styles from './ProfileSetupForm.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'プロフィールを作成しましょう',
  robots: { index: false, follow: false },
};

export default async function ProfileSetupPage() {
  const uid = await getLoggedInUid();
  if (!uid) redirect('/login');

  const snap = await db.collection('users').doc(uid).get();
  const profile = snap.exists ? snap.get('profile') : undefined;
  const gate = readOnboardingGate(profile);
  const initial = setupFormInitial(profile);
  const initialPhotoOwned = parseOwnedSetupPhoto(initial.photoUrl, uid, bucket.name) !== null;

  return (
    <>
      <Header />
      <main className={styles.page}>
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
      </main>
      <Footer />
    </>
  );
}
