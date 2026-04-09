'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './UserPageNavHeader.module.css';

type SessionData = {
  loggedIn?: boolean;
  uid?: string;
  username?: string;
  name?: string;
};

export default function UserPageNavHeader() {
  const [session, setSession] = useState<SessionData>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const userAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session', { credentials: 'include' });
        const data = (await res.json()) as SessionData;
        if (!cancelled) setSession(data);
      } catch {
        if (!cancelled) setSession({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;

    function handlePointerDown(event: Event) {
      const el = userAreaRef.current;
      const t = event.target;
      if (el && t instanceof Node && !el.contains(t)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [dropdownOpen]);

  const loggedIn = Boolean(session.loggedIn && session.uid);
  const mypageHref = session.uid ? `/user/${session.uid}` : '/top';

  return (
    <header className={styles.bar} aria-label="ユーザーページナビゲーション">
      <div className={styles.inner}>
        <Link href="/top" className={styles.logo}>
          Procom
        </Link>

        <div className={styles.center}>
          <form action="/users" method="get" className={styles.searchForm}>
            <input
              type="search"
              name="q"
              placeholder="検索"
              className={styles.searchInput}
              autoComplete="off"
              aria-label="検索"
            />
          </form>
        </div>

        <div className={styles.userArea} ref={userAreaRef}>
          {loggedIn ? (
            <>
              <button
                type="button"
                className={styles.mypageBtn}
                onClick={() => setDropdownOpen((v) => !v)}
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
              >
                マイページ
              </button>
              {dropdownOpen && (
                <div className={styles.dropdown} role="menu">
                  <Link
                    href={mypageHref}
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    マイページへ
                  </Link>
                  <Link
                    href="/account"
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                  >
                    設定
                  </Link>
                  <form action="/api/logout" method="GET" className={styles.dropdownItemForm}>
                    <button type="submit" className={styles.dropdownItem}>
                      ログアウト
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <Link href="/login" className={styles.loginBtn}>
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
