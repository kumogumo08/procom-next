'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { resolveFirstPhotoUrl, type CategoryUser } from '@/components/TopCategoryUserCards';
import { PUBLIC_USERS_PAGE_SIZE, usersPageHref } from '@/lib/publicUserDirectory';

import UsersPagination from './UsersPagination';
import styles from './users.module.css';

function UserList({ users }: { users: CategoryUser[] }) {
  return (
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
  );
}

export default function UsersPageClient({
  q,
  searchPage,
  listError,
  showDirectory,
  directoryMode,
  directoryUsers,
  directoryPage,
  directoryPageCount,
  crawlPages,
}: {
  q: string;
  searchPage: number;
  listError: boolean;
  showDirectory: boolean;
  directoryMode: 'newest' | 'fixed' | 'legacy';
  directoryUsers: CategoryUser[];
  directoryPage: number;
  directoryPageCount: number;
  crawlPages: number[];
}) {
  const [users, setUsers] = useState<CategoryUser[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(q));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!q) {
      setUsers([]);
      setTruncated(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = (await res.json()) as { users?: CategoryUser[]; error?: string; truncated?: boolean };
      if (!res.ok) {
        setError(data.error ?? '取得に失敗しました');
        setUsers([]);
        setTruncated(false);
        return;
      }
      setUsers(Array.isArray(data.users) ? data.users : []);
      setTruncated(data.truncated === true);
    } catch {
      setError('通信に失敗しました');
      setUsers([]);
      setTruncated(false);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchPageCount = Math.max(1, Math.ceil(users.length / PUBLIC_USERS_PAGE_SIZE));
  const searchOutOfRange = users.length > 0 && searchPage > searchPageCount;
  const visibleSearchUsers = searchOutOfRange
    ? []
    : users.slice((searchPage - 1) * PUBLIC_USERS_PAGE_SIZE, searchPage * PUBLIC_USERS_PAGE_SIZE);

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

        {q ? (
          loading ? (
            <p className={styles.muted}>読み込み中…</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : users.length === 0 ? (
            <p className={styles.empty}>「{q}」に一致するユーザーは見つかりませんでした。</p>
          ) : searchOutOfRange ? (
            <p className={styles.empty}>
              このページには検索結果がありません。{' '}
              <Link href={usersPageHref(1, q)}>検索結果の最初へ</Link>
            </p>
          ) : (
            <>
              <UserList users={visibleSearchUsers} />
              {truncated ? (
                <p className={styles.hint}>
                  同じ文字の並びを含む人が多いため、一致する人がすべて表示されているとは限りません。
                </p>
              ) : null}
              <UsersPagination
                page={searchPage}
                pageCount={searchPageCount}
                hrefForPage={(page) => usersPageHref(page, q)}
              />
            </>
          )
        ) : (
          <>
            <p className={styles.hint}>キーワードを入力して検索してください。</p>
            {listError ? (
              <p className={styles.error}>ユーザー一覧の取得に失敗しました。</p>
            ) : showDirectory ? (
              <section className={styles.recent} aria-labelledby="users-list-heading">
                <h2 id="users-list-heading" className={styles.sectionHeading}>
                  {directoryMode === 'newest'
                    ? '新着のユーザー'
                    : directoryMode === 'legacy' && directoryPage <= 1
                      ? 'ユーザー一覧'
                      : `ユーザー一覧（${directoryPage}ページ目）`}
                </h2>
                {directoryUsers.length === 0 ? (
                  <p className={styles.empty}>
                    {directoryMode === 'newest'
                      ? '公開中のユーザーはまだいません。'
                      : 'このページの公開プロフィールはありません。'}
                  </p>
                ) : (
                  <UserList users={directoryUsers} />
                )}
                {directoryMode === 'newest' && directoryPageCount > 0 ? (
                  <p className={styles.hint}>
                    <Link href="/users?page=1">固定一覧の1ページ目へ</Link>
                  </p>
                ) : null}
                {directoryMode === 'fixed' || directoryMode === 'legacy' ? (
                  <UsersPagination
                    page={directoryPage}
                    pageCount={directoryPageCount}
                    pageNumbers={crawlPages}
                    hrefForPage={(page) =>
                      directoryMode === 'legacy' ? usersPageHref(page) : `/users?page=${page}`
                    }
                  />
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
