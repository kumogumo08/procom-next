import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import Footer from '@/components/Footer';
import ProfileActivityTabs from '@/components/ProfileActivityTabs';
import UserPageNavHeader from '@/components/UserPageNavHeader';
import { mypageView } from '@/lib/accountKind';
import { ACCOUNT_SUSPENDED_PATH, readUserSuspended } from '@/lib/accountSuspension';
import { AUTH_UNAVAILABLE_MESSAGE, isAuthUnavailable } from '@/lib/activeSession';
import { canonicalFanIconUrl } from '@/lib/fanIcon';
import { isFanActivityPublic } from '@/lib/fanActivityVisibility';
import { bucket, db } from '@/lib/firebase-admin';
import FanActivityVisibility from './FanActivityVisibility';
import FanIconEditor from './FanIconEditor';
import { formatTokyoDate, sumSupportCounts } from '@/lib/mypageActivity';
import { loadMypageActivity } from '@/lib/mypageActivityServer';
import { getLoggedInUid } from '@/lib/session';

import styles from './mypage.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'マイページ - Procom',
  robots: { index: false, follow: false },
};

export default async function MyPage() {
  let uid: string | null = null;
  try {
    uid = await getLoggedInUid();
  } catch (err: unknown) {
    if (!isAuthUnavailable(err)) throw err;
    return (
      <>
        <UserPageNavHeader />
        <main className={styles.page}>
          <section className={styles.card}>
            <p className={styles.note}>{AUTH_UNAVAILABLE_MESSAGE}</p>
          </section>
        </main>
        <Footer />
      </>
    );
  }
  if (!uid) redirect('/login');

  const snap = await db.collection('users').doc(uid).get();
  if (readUserSuspended(snap.data())) redirect(ACCOUNT_SUSPENDED_PATH);
  if (!snap.exists) {
    return (
      <>
        <UserPageNavHeader />
        <main className={styles.page}>
          <section className={styles.card}>
            <h1 className={styles.name}>マイページ</h1>
            <p className={styles.note}>アカウント情報を確認できません。</p>
            <p className={styles.links}>
              <Link href="/account">アカウント設定</Link>
            </p>
          </section>
        </main>
        <Footer />
      </>
    );
  }
  if (snap.get('deletionPending') === true) {
    return (
      <>
        <UserPageNavHeader />
        <main className={styles.page}>
          <section className={styles.card}>
            <h1 className={styles.name}>マイページ</h1>
            <p className={styles.note}>退会処理中です。</p>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const view = mypageView(snap.get('accountKind'), snap.get('profile'), snap.get('fanName'));
  const fanIconUrl = view.role === 'fan' ? canonicalFanIconUrl(snap.get('fanIconUrl'), uid, bucket.name) : null;
  const activity = await loadMypageActivity(uid, snap.get('favorites'));
  const supportTotal = sumSupportCounts(activity.supports);

  return (
    <>
      <UserPageNavHeader />
      <main className={styles.page}>
        <ProfileActivityTabs
          current="activity"
          profileUid={view.role === 'fan' ? undefined : uid}
          contained
        />
        <section className={styles.card}>
          <p className={styles.kicker}>マイページ</p>
          {view.role === 'fan' ? (
            <div className={styles.identity}>
              <FanIconEditor initialUrl={fanIconUrl} />
              <div className={styles.identityText}>
                <h1 className={styles.name}>{view.displayName}</h1>
                <p className={styles.role}>アカウント種別：{view.roleLabel}</p>
              </div>
            </div>
          ) : (
            <>
              <h1 className={styles.name}>{view.displayName}</h1>
              <p className={styles.role}>アカウント種別：{view.roleLabel}</p>
              <FanActivityVisibility
                initialPublic={isFanActivityPublic(snap.get('accountKind'), snap.get('fanActivityPublic'))}
              />
            </>
          )}
        </section>

        <section className={styles.card} aria-labelledby="mypage-favorites">
          <h2 id="mypage-favorites" className={styles.sectionTitle}>
            お気に入り
          </h2>
          {activity.favoriteError ? (
            <p className={styles.note}>お気に入りを読み込めませんでした。</p>
          ) : (
            <>
              <p className={styles.count}>{activity.favorites.length}件</p>
              {activity.favorites.length === 0 ? (
                <p className={styles.note}>お気に入りはまだありません。</p>
              ) : (
                <ul className={styles.list}>
                  {activity.favorites.map((creator) => (
                    <li key={creator.uid}>
                      <Link href={`/user/${creator.uid}`} className={styles.person}>
                        {creator.photoUrl ? (
                          <img src={creator.photoUrl} alt="" className={styles.avatar} />
                        ) : (
                          <span className={styles.avatarFallback} aria-hidden="true" />
                        )}
                        <span className={styles.personName}>{creator.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {activity.favoritesTruncated ? <p className={styles.note}>50件まで表示しています。</p> : null}
            </>
          )}
        </section>

        <section className={styles.card} aria-labelledby="mypage-support">
          <h2 id="mypage-support" className={styles.sectionTitle}>
            応援履歴
          </h2>
          {activity.supportError ? (
            <p className={styles.note}>応援履歴を読み込めませんでした。</p>
          ) : (
            <>
              <p className={styles.count}>累計 {supportTotal}回</p>
              {activity.supports.length === 0 ? (
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
                          {creator.lastAt ? (
                            <span className={styles.meta}>最終応援日 {formatTokyoDate(creator.lastAt)}</span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {activity.supportsTruncated ? <p className={styles.note}>50件まで表示しています。</p> : null}
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
