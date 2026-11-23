import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import Footer from '@/components/Footer';
import ProfileActivityTabs from '@/components/ProfileActivityTabs';
import UserPageNavHeader from '@/components/UserPageNavHeader';
import { loadPublicFanActivity } from '@/lib/publicFanActivityServer';

import styles from '../../../mypage/mypage.module.css';

export const dynamic = 'force-dynamic';

const UID_PATTERN = /^[A-Za-z0-9]{1,128}$/;

export const metadata: Metadata = {
  title: 'ファン活動 - Procom',
  robots: { index: false, follow: false },
};

export default async function PublicFanActivityPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  if (!UID_PATTERN.test(uid)) notFound();
  const activity = await loadPublicFanActivity(uid);
  if (!activity) {
    return (
      <>
        <UserPageNavHeader />
        <main className={styles.page}>
          <section className={styles.card}>
            <h1 className={styles.name}>ファン活動</h1>
            <p className={styles.note}>このファン活動は公開されていません</p>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <UserPageNavHeader />
      <ProfileActivityTabs
        current="activity"
        profileUid={uid}
        activityHref={`/user/${uid}/activity`}
      />
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="public-fan-activity">
          <h1 id="public-fan-activity" className={styles.sectionTitle}>
            ファン活動
          </h1>
          {!activity.error ? null : <p className={styles.note}>応援履歴を読み込めませんでした。</p>}
          {activity.error ? null : activity.supports.length === 0 ? (
            <p className={styles.note}>応援履歴はまだありません。</p>
          ) : (
            <ul className={styles.list}>
              {activity.supports.map((creator) => (
                <li key={creator.uid}>
                  <Link href={`/user/${creator.uid}`} className={styles.person}>
                    {creator.photoUrl ? (
                      <img src={creator.photoUrl} alt="" className={styles.avatar} />
                    ) : (
                      <span className={styles.avatarFallback} aria-hidden="true" />
                    )}
                    <span className={styles.personBody}>
                      <span className={styles.personName}>{creator.name}</span>
                      <span className={styles.meta}>累計 {creator.count}回</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {activity?.truncated ? <p className={styles.note}>50件まで表示しています。</p> : null}
        </section>
      </main>
      <Footer />
    </>
  );
}
