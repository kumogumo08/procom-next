'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { resolveFirstPhotoUrl, type CategoryUser } from '@/components/TopCategoryUserCards';

import styles from './users.module.css';

export default function UsersPageClient() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';

  const [users, setUsers] = useState<CategoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!q) {
      setUsers([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = (await res.json()) as { users?: CategoryUser[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? '取得に失敗しました');
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError('通信に失敗しました');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>ユーザー検索・一覧</h1>

        <form action="/users" method="get" className={styles.searchForm} role="search">
          <label className={styles.label} htmlFor="users-q">
            名前・肩書きで検索
          </label>
          <div className={styles.searchRow}>
            <input
              id="users-q"
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="名前や肩書きで検索"
              className={styles.input}
              autoComplete="off"
            />
            <button type="submit" className={styles.submit}>
              検索
            </button>
          </div>
        </form>

        {!q ? (
          <p className={styles.hint}>キーワードを入力して検索してください。</p>
        ) : loading ? (
          <p className={styles.muted}>読み込み中…</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : users.length === 0 ? (
          <p className={styles.empty}>「{q}」に一致するユーザーは見つかりませんでした。</p>
        ) : (
          <ul className={styles.list}>
            {users.map(({ uid, profile }) => {
              const name = profile?.name?.trim() || 'ユーザー';
              const title = profile?.title?.trim() || '';
              const photoUrl = resolveFirstPhotoUrl(profile?.photos);
              return (
                <li key={uid} className={styles.item}>
                  <Link href={`/user/${uid}`} className={styles.card}>
                    <div className={styles.thumbWrap}>
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="" className={styles.thumb} />
                      ) : (
                        <div className={styles.thumbPlaceholder} aria-hidden />
                      )}
                    </div>
                    <div className={styles.meta}>
                      <span className={styles.name}>{name}</span>
                      {title ? <span className={styles.sub}>{title}</span> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
