'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { selectSpotlight, spotlightProfileHref, type SpotlightCandidate } from '@/lib/listing/spotlight';
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
 * 「こんな人が使っています」。
 * 初期表示はサーバーが時間単位で固定した12人。マウント後に同じ候補から一度だけ抽選し直す。
 */
export default function TopSpotlightUsers({
  initialUsers,
  featuredUid,
  pool,
  sampledAt,
}: {
  initialUsers: SpotlightCandidate[];
  featuredUid: string | null;
  pool: SpotlightCandidate[];
  sampledAt: number;
}) {
  const [view, setView] = useState({ users: initialUsers, featuredUid });
  const rolled = useRef(false);

  useEffect(() => {
    if (rolled.current) return;
    rolled.current = true;
    const pick = selectSpotlight(pool, sampledAt, Math.random);
    if (pick.users.length === 0) return;
    setView({ users: pick.users, featuredUid: pick.featuredUid });
  }, [pool, sampledAt]);

  if (view.users.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-label="利用者の一例">
      <div className={styles.inner}>
        <p className={styles.kicker}>Community</p>
        <h2 className={styles.title}>こんな人が使っています</h2>
        <p className={styles.lead}>横にスワイプして、プロフィールをのぞいてみてください。</p>
        <div className={styles.track}>
          {view.users.map((user) => {
            const name = user.name.trim() || 'ユーザー';
            const title = user.title.trim();
            const photoUrl = user.photoUrl;
            const featured = user.uid === view.featuredUid;
            return (
              <Link
                key={user.uid}
                href={spotlightProfileHref(user.uid)}
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
