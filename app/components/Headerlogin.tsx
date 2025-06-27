'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthUI from '@/components/AuthUI';

export default function Headerlogin() {
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionUid, setSessionUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

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

  const isLoggedIn = !!sessionName;

  return (
    <header>
      {/* ✅ ログイン済みのときだけナビゲーションを表示 */}
      {isLoggedIn && (
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
        <form action="/users.html" method="GET" className="search-form">
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
  );
}

