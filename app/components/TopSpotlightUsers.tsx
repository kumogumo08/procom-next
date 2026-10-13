'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { resolveFirstPhotoUrl, type CategoryUser } from '@/components/TopCategoryUserCards';
import styles from './TopSpotlight.module.css';

function SpotlightUserThumb({ photoUrl }: { photoUrl: string }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  const showPlaceholder = !photoUrl || imgFailed;

  if (showPlaceholder) {
    return (
      <div className={styles.thumbPlaceholder} aria-hidden>
        <span className={styles.thumbSilhouette} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 外部ストレージ URL
    <img
      src={photoUrl}
      alt=""
      className={styles.thumb}
      onError={() => setImgFailed(true)}
    />
  );
}

/**
 * 「こんな人が使っています」。画像ありの新着最大12件をサーバーから受け取る。
 */
export default function TopSpotlightUsers({ initialUsers = [] }: { initialUsers?: CategoryUser[] }) {
  const [users] = useState<CategoryUser[]>(initialUsers);

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
                  <SpotlightUserThumb photoUrl={photoUrl} />
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
