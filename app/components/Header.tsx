'use client';

import { useEffect, useState } from 'react';
import styles from './Header.module.css';
import Link from 'next/link';
import Image from 'next/image';

type SessionData = {
  loggedIn: boolean;
  uid?: string;
  username?: string;
  name?: string;
  isAdmin?: boolean; // ← 管理者判定を追加
};

export default function Header() {
  const [session, setSession] = useState<SessionData>({ loggedIn: false });
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/session', { credentials: 'include' });
        const data = await res.json();
        setSession(data);
      } catch {
        setSession({ loggedIn: false });
      }
    }
    fetchSession();
  }, []);

  return (
    <>
      {/* ✅ PCヘッダー */}
      <header className={styles.pcHeader}>
        <h1 className={styles.title}>
          <a href="/top" className={styles.link}>Procom</a>
        </h1>

        {session.loggedIn && (session.name || session.username) && (
          <h2 className={styles.username}>
            {(session.name ?? session.username)}さんのページ
          </h2>
        )}

        <p className={styles.tagline}>あなたのすべてを、ここに集約。</p>
        <p className={styles.description}>
          Procomは、あなたのSNS・プロフィール・活動情報を一つにまとめる自己発信プラットフォームです。
        </p>

        {session.loggedIn ? (
          <div className={styles.authUI}>
            <p className={styles.authGreeting}>
              ようこそ、{session.name ?? session.username}さん！
            </p>
            <div className={styles.authButtons}>
              <Link href={`/user/${session.uid}`} className="mypage-btn">マイページ</Link>

              {/* 管理者専用リンク */}
              {session.isAdmin && (
                <Link href="/admin/news" className="mypage-btn" style={{ background: 'orange' }}>
                  NEWS管理
                </Link>
              )}

              <form action="/api/logout" method="GET">
                <button type="submit" className="mypage-btn">ログアウト</button>
              </form>
            </div>
            <div style={{ textAlign: 'center', marginTop: '5px' }}>
              <Link href="/account" className="mypage-btn account-setting"
                style={{ fontSize: '0.9rem', background: 'transparent', color: '#fff' }}>
                ⚙ アカウント設定
              </Link>
            </div>
          </div>
        ) : (
          <p className={styles.authLink}>
            <a href="/login">ログイン・新規会員登録はこちら</a>
          </p>
        )}

        <div className={styles.searchWrapper}>
          <form action="/users" method="GET" className={styles.searchForm}>
            <input
              type="text"
              name="q"
              placeholder="名前や肩書きで検索"
              required
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchButton}>検索</button>
          </form>
        </div>
      </header>

      {/* ✅ スマホヘッダー */}
      <header className={styles.mobileHeader}>
        <div className={styles.topBar}>
          <Link href="/top" className={styles.logo}>Procom</Link>
          <div className={styles.iconButtons}>
            <button onClick={() => setShowSearch(!showSearch)} className={styles.icon}>
              <img src="/25923944.png" alt="検索" className={styles.iconImage} />
            </button>
            <button onClick={() => setShowMenu(!showMenu)} className={styles.icon}>☰</button>
          </div>
        </div>

        {showSearch && (
          <div className={styles.searchBox}>
            <form action="/users" method="GET">
              <input
                type="text"
                name="q"
                placeholder="名前や肩書きで検索"
                required
                className={styles.searchInput}
              />
              <button type="submit" className={styles.searchButton}>検索</button>
            </form>
          </div>
        )}

        {showMenu && (
          <nav className={styles.menuBox}>
            {session.loggedIn ? (
              <>
                <p className={styles.greeting}>
                  ようこそ、{session.name ?? session.username}さん！
                </p>
                <Link href={`/user/${session.uid}`} className={styles.menuLink}>マイページ</Link>
                
                {/* 管理者専用リンク（スマホ版） */}
                {session.isAdmin && (
                  <Link href="/admin/news" className={styles.menuLink} style={{ color: 'orange' }}>
                    NEWS管理
                  </Link>
                )}

                <Link href="/account" className={styles.menuLink}>⚙ アカウント設定</Link>
                <form action="/api/logout" method="GET">
                  <button type="submit" className={styles.menuLink}>ログアウト</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className={styles.menuLink}>ログイン・新規会員登録</Link>
              </>
            )}
          </nav>
        )}
      </header>
    </>
  );
}
