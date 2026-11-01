'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SessionData = {
  loggedIn: boolean;
  uid?: string;
  username?: string;
  name?: string;
};

export default function AuthUI() {
  const [session, setSession] = useState<SessionData>({ loggedIn: false });
  const [isOwnPage, setIsOwnPage] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef<HTMLUListElement>(null);
  const router = useRouter(); // ✅ 追加

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/session', {
        credentials: 'include',
        cache: 'no-store', // ← これが重要！
      });
        if (res.status === 503) return;
        const data = await res.json();
        if (!res.ok) return;
        setSession(data);
        const currentUid = decodeURIComponent(window.location.pathname.split('/').pop() || '');
        setIsOwnPage(data.uid === currentUid);
        setIsMobile(window.innerWidth <= 768);
      } catch {
        setSession({ loggedIn: false });
      }
    }
    fetchSession();

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

    useEffect(() => {
      const timer = setTimeout(() => {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const toggleMenu = () => navRef.current?.classList.toggle('show');
        hamburgerBtn?.addEventListener('click', toggleMenu);

        return () => hamburgerBtn?.removeEventListener('click', toggleMenu);
      }, 0);

      return () => clearTimeout(timer);
    }, []);

const handleLogout = async () => {
  await fetch('/api/logout', {
    method: 'GET',
    credentials: 'include', // 🔑 これがないとセッション破棄できない
  });
  router.push('/top');
};

  if (!session.loggedIn) return null;

  return (
    <>
      {isMobile ? (
        <ul ref={navRef} className="nav-links">
          <li><Link href={`/user/${session.uid}`} className="mypage-btn">マイページ</Link></li>
          <li><button onClick={handleLogout}>ログアウト</button></li>
          <li><Link href="/account">⚙ アカウント設定</Link></li>
        </ul>
      ) : (
        <div className="auth-forms show" style={{ textAlign: 'right', marginTop: 10 }}>
          <p>ようこそ、{session.name ?? session.username}さん！</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Link href={`/user/${session.uid}`} className="mypage-btn">マイページ</Link>
            <button onClick={handleLogout} className="mypage-btn">ログアウト</button>
          </div>
          <div style={{ marginTop: 5 }}>
            <Link href="/account" className="mypage-btn" style={{ fontSize: '0.9rem', background: 'transparent', color: '#6a1b9a' }}>
              ⚙ アカウント設定
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
