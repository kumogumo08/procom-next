import Image from 'next/image';
import Link from 'next/link';

import styles from './AuthHeader.module.css';

/** ログイン・登録など、フォームに集中させるページ用。検索やメニューは出さない。 */
export default function AuthHeader() {
  return (
    <header className={styles.header}>
      <Link href="/top" className={styles.logo}>
        <Image src="/procom-logo.png" alt="" width={42} height={42} className={styles.mark} />
        <span className={styles.word}>Procom</span>
      </Link>
    </header>
  );
}
