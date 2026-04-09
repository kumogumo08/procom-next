'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './TopCategoryUserCards.module.css';

type Profile = {
  name?: string;
  title?: string;
  photos?: unknown[];
};

export type CategoryUser = {
  uid: string;
  profile: Profile;
};

type Section = {
  slug: string;
  label: string;
  users: CategoryUser[];
};

/** TOP カード用: 先頭写真の URL（string / { url } の両方を吸収） */
export function resolveFirstPhotoUrl(photos: unknown): string {
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const raw = photos[0];
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object' && 'url' in raw) {
    const u = (raw as { url?: string }).url;
    return typeof u === 'string' ? u.trim() : '';
  }
  return '';
}

const CATEGORIES: { slug: string; label: string }[] = [
  { slug: 'ダンサー', label: 'ダンサー' },
  { slug: 'YouTuber', label: 'YouTuber' },
  { slug: 'インフルエンサー', label: 'インフルエンサー' },
  { slug: 'モデル', label: 'モデル' },
  { slug: '歌手', label: '歌手' },
];

export default function TopCategoryUserCards() {
  const [sections, setSections] = useState<Section[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          CATEGORIES.map(async ({ slug, label }) => {
            const res = await fetch(
              `/api/category-users?category=${encodeURIComponent(slug)}`,
              { cache: 'no-store' }
            );
            const data = (await res.json()) as { users?: CategoryUser[] };
            const users = Array.isArray(data.users) ? data.users : [];
            return { slug, label, users };
          })
        );
        if (!cancelled) setSections(results.filter((s) => s.users.length > 0));
      } catch {
        if (!cancelled) setSections([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (sections === null) {
    return (
      <section className={styles.root} aria-busy="true" aria-label="カテゴリ別ユーザー">
        <p className={styles.loading}>読み込み中…</p>
      </section>
    );
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <section className={styles.root} aria-label="カテゴリ別ユーザー">
      {sections.map((sec) => (
        <div key={sec.slug} className={styles.block}>
          <h2 className={styles.heading}>{sec.label}</h2>
          <div className={styles.scroller}>
            {sec.users.map(({ uid, profile }) => {
              const name = profile?.name?.trim() || 'ユーザー';
              const title = profile?.title?.trim() || '';
              const photoUrl = resolveFirstPhotoUrl(profile?.photos);
              return (
                <Link
                  key={uid}
                  href={`/user/${uid}`}
                  className={styles.card}
                >
                  <div className={styles.thumbWrap}>
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 外部ストレージ URL、一覧用サムネイル
                      <img
                        src={photoUrl}
                        alt=""
                        className={styles.thumb}
                      />
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
      ))}
    </section>
  );
}
