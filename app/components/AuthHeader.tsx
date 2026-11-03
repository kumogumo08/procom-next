import Link from 'next/link';

import styles from './AuthHeader.module.css';

/** ログイン・登録など、フォームに集中させるページ用。検索やメニューは出さない。 */
export default function AuthHeader() {
  return (
    <header className={styles.header}>
      <Link href="/top" className={styles.logo}>
        Procom
      </Link>
    </header>
  );
}
