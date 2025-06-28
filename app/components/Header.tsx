'use client';

import { useEffect, useState } from 'react';
import styles from './Header.module.css';
import Link from 'next/link';

type SessionData = {
  loggedIn: boolean;
  uid?: string;
  username?: string;
  name?: string; // ✅ 追加
};

export default function Header() {
  const [session, setSession] = useState<SessionData>({ loggedIn: false });

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
    <header className={styles.header}>
      <h1 className={styles.title}>
        <a href="/top" className={styles.link}>
          Procom
        </a>
      </h1>

      {/* 👤 ユーザー名を表示 */}
      {session.loggedIn && (session.name || session.username) && (
        <h2 className={styles.username}>
          {(session.name ?? session.username)}さんのページ
        </h2>
      )}

      <p className={styles.tagline}>あなたのすべてを、ここに集約。</p>
      <p className={styles.description}>
        Procomは、あなたのSNS・プロフィール・活動情報を一つにまとめる自己発信プラットフォームです。
      </p>

      {/* 🔁 ログイン／ログアウトのリンク */}
      {session.loggedIn ? (
      <div className={styles.authUI}>
        <p className={styles.authGreeting}>
          ようこそ、{session.name ?? session.username}さん！
        </p>

        <div className={styles.authButtons}>
          <Link href={`/user/${session.uid}`} className="mypage-btn">マイページ</Link>
          <form action="/api/logout" method="GET">
            <button type="submit" className="mypage-btn">ログアウト</button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '5px' }}>
          <Link
            href="/account"
            className="mypage-btn account-setting"
            style={{ fontSize: '0.9rem', background: 'transparent', color: '#fff' }} // ← 色を白に
          >
            ⚙ アカウント設定
          </Link>
        </div>
      </div>
      ) : (
        <p className={styles.authLink}>
          <a href="/login">ログイン・新規会員登録はこちら</a>
        </p>
      )}

      {/* 🔍 検索フォーム */}
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
  );
}

