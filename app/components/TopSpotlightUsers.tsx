'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { resolveFirstPhotoUrl, type CategoryUser } from '@/components/TopCategoryUserCards';
import styles from './TopSpotlight.module.css';

/**
 * 「こんな人が使っています」— /api/category-users?category=new（ランダム最大12件）
 */
export default function TopSpotlightUsers() {
  const [users, setUsers] = useState<CategoryUser[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/category-users?category=new', { cache: 'no-store' });
        const data = (await res.json()) as { users?: CategoryUser[] };
        const list = Array.isArray(data.users) ? data.users : [];
        if (!cancelled) setUsers(list);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (users === null) {
    return (
      <section className={styles.section} aria-busy="true" aria-label="利用者の一例">
        <div className={styles.inner}>
          <p className={styles.muted}>読み込み中…</p>
        </div>
      </section>
    );
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-label="利用者の一例">
      <div className={styles.inner}>
        <p className={styles.kicker}>Community</p>
        <h2 className={styles.title}>こんな人が使っています</h2>
        <p className={styles.lead}>横にスワイプして、プロフィールをのぞいてみてください。</p>
        <div className={styles.track}>
          {users.map(({ uid, profile }, index) => {
            const name = profile?.name?.trim() || 'ユーザー';
            const title = profile?.title?.trim() || '';
            const photoUrl = resolveFirstPhotoUrl(profile?.photos);
            const featured = index === 0;
            return (
              <Link
                key={uid}
                href={`/user/${uid}`}
                className={`${styles.card} ${featured ? styles.cardFeatured : styles.cardStandard}`}
              >
                <div className={styles.thumbWrap}>
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 外部ストレージ URL
                    <img src={photoUrl} alt="" className={styles.thumb} />
                  ) : (
                    <div className={styles.thumbPlaceholder} aria-hidden />
                  )}
                </div>
                <div className={styles.meta}>
                  {featured ? <span className={styles.badge}>PICK UP</span> : null}
                  <p className={styles.name}>{name}</p>
                  {title ? <p className={styles.job}>{title}</p> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
