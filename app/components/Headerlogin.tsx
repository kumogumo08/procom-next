'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthUI from '@/components/AuthUI';
import styles from './Header.module.css';
import UserListToggle from '@/components/UserListToggle'; // ← パスは配置に応じて調整

export default function Headerlogin() {
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionUid, setSessionUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const sessionRes = await fetch('/api/session');
        const session = await sessionRes.json();
        if (session.loggedIn) {
          setSessionName(session.name || session.username);
          setSessionUid(session.uid);
        }

        const uidFromPath = window.location.pathname.split('/').pop();
        if (!uidFromPath) return;

        const userRes = await fetch(`/api/user/${uidFromPath}`);
        const userData = await userRes.json();
        const pageName = userData?.profile?.name || 'ユーザー';

        setDisplayName(session.uid === uidFromPath ? session.name : pageName);
      } catch (e) {
        console.error('名前の取得に失敗しました', e);
        setDisplayName('ユーザー');
      }
    };

    fetchNames();
  }, []);

  return (
    <>
      {/* ✅ スマホ用ヘッダー */}
      <header className={`${styles.mobileHeader} mobile-only`}>
        <div className={styles.topBar}>
          <Link href="/top" className={styles.logo}>Procom</Link>
          <div className={styles.mobileTagline}>あなたのすべてをここに</div>
          <div className={styles.iconButtons}>
            <button onClick={() => setShowSearch(!showSearch)} className={styles.icon}>
              <img src="/25923944.png" alt="検索" className={styles.iconImage} />
            </button>
            <button onClick={() => setShowMenu(!showMenu)} className={styles.icon}>☰</button>
          </div>
        </div>

        <div style={{ margin: '6px 12px', textAlign: 'left' }}>
          <UserListToggle />
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
            {sessionName ? (
              <>
                <p className={styles.greeting}>ようこそ、{sessionName}さん！</p>
                <Link href={`/user/${sessionUid}`} className={styles.menuLink}>マイページ</Link>
                <Link href="/account" className={styles.menuLink}>⚙ アカウント設定</Link>
                <form action="/api/logout" method="GET">
                  <button type="submit" className={styles.menuLink}>ログアウト</button>
                </form>
              </>
            ) : (
              <Link href="/login" className={styles.menuLink}>ログイン・新規会員登録</Link>
            )}
          </nav>
        )}

        {/* お気に入りボタンは常に表示 */}
        <div id="favorite-wrapper" style={{ textAlign: 'center', marginTop: '12px' }}>
          <button id="favoriteBtn" className="favorite-button">
            ⭐ お気に入りに登録
          </button>
        </div>
      </header>

      {/* ✅ PC用ヘッダー（今までのまま） */}
      <header className="pc-only" style={{ position: 'relative' }}>
        {/* 🔽 左上固定表示 */}
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <UserListToggle />
        </div>
        {sessionName && (
          <nav className="nav">
            <button id="hamburgerBtn" className="hamburger" aria-label="メニュー">☰</button>
            <div id="navLinks">
              <AuthUI />
            </div>
          </nav>
        )}

        <h1>
          <Link href="/top">
            <span style={{ color: 'inherit', textDecoration: 'none' }}>Procom</span>
          </Link>
        </h1>

        {displayName && (
          <h2 style={{ textAlign: 'center', margin: '8px 0', fontWeight: 'bold', fontSize: '1.8rem' }}>
            {displayName}さんのページ
          </h2>
        )}

        <p className="tagline">あなたのすべてを、ここに集約。</p>
        <p className="description">
          Procomは、あなたのSNS・プロフィール・活動情報を一つにまとめる自己発信プラットフォームです。
        </p>

        <div className="search-wrapper">
          <form action="/users" method="GET" className="search-form">
            <input type="text" name="q" placeholder="名前や肩書きで検索" required />
            <button type="submit">検索</button>
          </form>
        </div>

        <div id="favorite-wrapper" style={{ textAlign: 'center', margin: '10px 0' }}>
          <button id="favoriteBtn" className="favorite-button">
            ⭐ このユーザーをお気に入りに登録
          </button>
        </div>
      </header>
    </>
  );
}
