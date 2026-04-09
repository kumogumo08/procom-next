'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { resolveFirstPhotoUrl, type CategoryUser } from '@/components/TopCategoryUserCards';
import styles from './TopCategoryUserCards.module.css';

/**
 * TOP の「新規登録者」行。
 * データは既存の /api/category-users?category=new と同じ（変更なし）。
 */
export default function TopNewUsersCards() {
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
      <section className={styles.root} aria-busy="true" aria-label="新規登録者">
        <p className={styles.loading}>読み込み中…</p>
      </section>
    );
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <section className={styles.root} aria-label="新規登録者">
      <div className={styles.block}>
        <h2 className={styles.heading}>🆕 新規登録者</h2>
        <div className={styles.scroller}>
          {users.map(({ uid, profile }) => {
            const name = profile?.name?.trim() || 'ユーザー';
            const title = profile?.title?.trim() || '';
            const photoUrl = resolveFirstPhotoUrl(profile?.photos);
            return (
              <Link key={uid} href={`/user/${uid}`} className={styles.card}>
                <div className={styles.thumbWrap}>
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 外部ストレージ URL、一覧用サムネイル
                    <img src={photoUrl} alt="" className={styles.thumb} />
                  ) : (
                    <div className={styles.thumbPlaceholder} aria-hidden />
                  )}
                </div>
                <div className={styles.meta}>
                  <p className={styles.name}>{name}</p>
                  {title ? <p className={styles.title}>{title}</p> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
