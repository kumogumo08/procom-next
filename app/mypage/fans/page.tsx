import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import Footer from '@/components/Footer';
import UserPageNavHeader from '@/components/UserPageNavHeader';
import { mypageView } from '@/lib/accountKind';
import { ACCOUNT_SUSPENDED_PATH, readUserSuspended } from '@/lib/accountSuspension';
import { AUTH_UNAVAILABLE_MESSAGE, isAuthUnavailable } from '@/lib/activeSession';
import { loadFanManagement } from '@/lib/fanManagementServer';
import { db } from '@/lib/firebase-admin';
import { formatTokyoDate, sumSupportCounts } from '@/lib/mypageActivity';
import { getLoggedInUid } from '@/lib/session';

import styles from '../mypage.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ファン管理 - Procom',
  robots: { index: false, follow: false },
};

export default async function FanManagementPage() {
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
            <h1 className={styles.name}>ファン管理</h1>
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
            <h1 className={styles.name}>ファン管理</h1>
            <p className={styles.note}>退会処理中です。</p>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const view = mypageView(snap.get('accountKind'), snap.get('profile'), snap.get('fanName'));
  if (view.role !== 'creator') {
    return (
      <>
        <UserPageNavHeader />
        <main className={styles.page}>
          <section className={styles.card}>
            <h1 className={styles.name}>ファン管理</h1>
            <p className={styles.note}>クリエイターのみ利用できます。</p>
            <p className={styles.links}>
              <Link href="/mypage">マイページへ戻る</Link>
            </p>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const management = await loadFanManagement(uid);
  const supportTotal = sumSupportCounts(management.supporters);

  return (
    <>
      <UserPageNavHeader />
      <main className={styles.page}>
        <section className={styles.card}>
          <p className={styles.kicker}>マイページ</p>
          <h1 className={styles.name}>ファン管理</h1>
          <p className={styles.links}>
            <Link href="/mypage">マイページへ戻る</Link>
          </p>
        </section>

        <section className={styles.card} aria-labelledby="fan-management-list">
          <h2 id="fan-management-list" className={styles.sectionTitle}>
            応援してくれた会員
          </h2>
          {management.error ? (
            <p className={styles.note}>ファン管理を読み込めませんでした。</p>
          ) : (
            <>
              <p className={styles.count}>応援してくれた会員数 {management.supporters.length}人</p>
              <p className={styles.count}>累計 {supportTotal}回</p>
              {management.supporters.length === 0 ? (
                <p className={styles.note}>応援してくれた会員はまだいません。</p>
              ) : (
                <ul className={styles.list}>
                  {management.supporters.map((supporter, index) => (
                    <li key={`${supporter.name}-${supporter.count}-${index}`}>
                      <div className={styles.person}>
                        {supporter.iconUrl ? (
                          <img src={supporter.iconUrl} alt="" className={styles.avatar} />
                        ) : (
                          <span className={styles.avatarFallback} aria-hidden="true" />
                        )}
                        <span className={styles.personBody}>
                          <span className={styles.personName}>{supporter.name}</span>
                          <span className={styles.meta}>累計 {supporter.count}回</span>
                          {supporter.firstAt ? (
                            <span className={styles.meta}>初回応援日 {formatTokyoDate(supporter.firstAt)}</span>
                          ) : null}
                          {supporter.lastAt ? (
                            <span className={styles.meta}>最終応援日 {formatTokyoDate(supporter.lastAt)}</span>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {management.truncated ? <p className={styles.note}>50件まで表示しています。</p> : null}
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
