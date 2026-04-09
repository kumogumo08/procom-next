'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import styles from './TopLandingHero.module.css';

type SessionData = {
  loggedIn: boolean;
  uid?: string;
  username?: string;
  name?: string;
  isAdmin?: boolean;
};

export default function TopLandingHero() {
  const [session, setSession] = useState<SessionData>({ loggedIn: false });
  const [showMenu, setShowMenu] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountWrapRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!accountMenuOpen) return;
    function handleDown(e: Event) {
      const el = accountWrapRef.current;
      const t = e.target;
      if (el && t instanceof Node && !el.contains(t)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('touchstart', handleDown);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
    };
  }, [accountMenuOpen]);

  return (
    <>
      <header className={styles.landingPc}>
        <div className={styles.topLandingWrap}>
          <div className={styles.headerBar}>
            <div className={styles.headerInner}>
              <Link href="/top" className={styles.logoLink}>
                <div className={styles.logo}>Procom</div>
              </Link>
              <div className={styles.topNavSpacer} aria-hidden />
              {!session.loggedIn ? (
                <Link href="/login" className={styles.topNavQuietLink}>
                  ログイン
                </Link>
              ) : (
                <div className={styles.topNavAccount} ref={accountWrapRef}>
                  <button
                    type="button"
                    className={styles.topNavAccountBtn}
                    onClick={() => setAccountMenuOpen((v) => !v)}
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="menu"
                  >
                    メニュー
                  </button>
                  {accountMenuOpen && (
                    <div className={styles.topNavDropdown} role="menu">
                      <Link
                        href={`/user/${session.uid}`}
                        className={styles.topNavDropdownItem}
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        マイページ
                      </Link>
                      {session.isAdmin ? (
                        <Link
                          href="/admin/news"
                          className={styles.topNavDropdownItem}
                          role="menuitem"
                          onClick={() => setAccountMenuOpen(false)}
                        >
                          NEWS管理
                        </Link>
                      ) : null}
                      <Link
                        href="/account"
                        className={styles.topNavDropdownItem}
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        設定
                      </Link>
                      <form action="/api/logout" method="GET" className={styles.topNavDropdownForm}>
                        <button type="submit" className={styles.topNavDropdownItem}>
                          ログアウト
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.topHeroBody}>
            <div className={styles.headlineWrap}>
              <h1 className={styles.heroHeadline}>活動を見つけてもらえる1ページに。</h1>
            </div>
            <p className={styles.topLandingSub}>
              SNS・プロフィール・実績をまとめて、あなたらしさが伝わるページを作れます。
            </p>
            <p className={styles.topLandingSearchLabel}>名前や肩書きで探す</p>
            <div className={styles.heroSearchWrapper}>
              <form action="/users" method="get" className={styles.heroSearchForm}>
                <input
                  type="search"
                  name="q"
                  placeholder="名前や肩書きで検索"
                  className={styles.heroSearchInput}
                  autoComplete="off"
                  aria-label="名前や肩書きで検索"
                />
                <button type="submit" className={styles.heroSearchButton}>
                  検索
                </button>
              </form>
            </div>
            <div className={styles.topLandingCtas}>
              <Link href="/login?mode=register" className={styles.topBtnPrimary}>
                無料で始める
              </Link>
              <Link href="/users" className={styles.topBtnGhost}>
                登録者を見る
              </Link>
            </div>
          </div>
        </div>
      </header>

      <header className={styles.landingMobile}>
        <div className={styles.headerBar}>
          <div className={styles.headerInner}>
            <Link href="/top" className={styles.logoLink}>
              <div className={styles.logo}>Procom</div>
            </Link>
            <div className={styles.iconButtons}>
              <button
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                className={styles.icon}
                aria-label="メニュー"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        <div className={styles.mobileLandingBlock}>
          <div className={styles.headlineWrap}>
            <h1 className={styles.heroHeadline}>活動を見つけてもらえる1ページに。</h1>
          </div>
          <p className={styles.mobileLandingSub}>
            SNS・プロフィール・実績をまとめて、あなたらしさが伝わるページを作れます。
          </p>
          <p className={styles.mobileLandingSearchLabel}>名前や肩書きで探す</p>
          <div className={styles.heroSearchWrapper}>
            <form action="/users" method="get" className={styles.heroSearchForm}>
              <input
                type="search"
                name="q"
                placeholder="名前や肩書きで検索"
                className={styles.heroSearchInput}
                autoComplete="off"
                aria-label="名前や肩書きで検索"
              />
              <button type="submit" className={styles.heroSearchButton}>
                検索
              </button>
            </form>
          </div>
          <div className={styles.topLandingCtas}>
            <Link href="/login?mode=register" className={styles.topBtnPrimary}>
              無料で始める
            </Link>
            <Link href="/users" className={styles.topBtnGhost}>
              登録者を見る
            </Link>
          </div>
        </div>

        {showMenu && (
          <nav className={styles.menuBox}>
            {session.loggedIn ? (
              <>
                <p className={styles.greeting}>ようこそ、{session.name ?? session.username}さん！</p>
                <Link href={`/user/${session.uid}`} className={styles.menuLink}>
                  マイページ
                </Link>
                {session.isAdmin && (
                  <Link href="/admin/news" className={styles.menuLink} style={{ color: 'orange' }}>
                    NEWS管理
                  </Link>
                )}
                <Link href="/account" className={styles.menuLink}>
                  設定
                </Link>
                <form action="/api/logout" method="GET">
                  <button type="submit" className={styles.menuLink}>
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className={styles.menuLink}>
                  ログイン
                </Link>
              </>
            )}
          </nav>
        )}
      </header>
    </>
  );
}
