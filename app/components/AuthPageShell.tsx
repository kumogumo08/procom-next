import type { ReactNode } from 'react';

import AuthHeader from '@/components/AuthHeader';
import Footer from '@/components/Footer';

import styles from './AuthPageShell.module.css';

/** 認証・案内ページの縦並び。中身が少なくてもフッターは画面下に届く。 */
export default function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AuthHeader />
      <div className={styles.main}>{children}</div>
      <Footer tone="auth" />
    </div>
  );
}
