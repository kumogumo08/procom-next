import Link from 'next/link';

import styles from './ProfileActivityTabs.module.css';

type Props = {
  current: 'profile' | 'activity';
  /** 本人の公開プロフィール。ファンには渡さない。 */
  profileUid?: string;
  /** 未指定は本人のマイページ。一般公開時だけ公開ページを渡す。 */
  activityHref?: string;
  /** 親カラムの幅に合わせる。マイページのカード列用。 */
  contained?: boolean;
};

function UserRoundIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export default function ProfileActivityTabs({
  current,
  profileUid,
  activityHref = '/mypage',
  contained = false,
}: Props) {
  const profileHref = profileUid ? `/user/${profileUid}` : null;

  return (
    <nav
      className={contained ? styles.shellContained : styles.shell}
      aria-label="プロフィールとファン活動"
    >
      <div className={styles.bar}>
        {profileHref ? (
          <Link
            href={profileHref}
            className={current === 'profile' ? styles.current : styles.link}
            aria-current={current === 'profile' ? 'page' : undefined}
          >
            <UserRoundIcon />
            プロフィール
          </Link>
        ) : null}
        <Link
          href={activityHref}
          className={current === 'activity' ? styles.current : styles.link}
          aria-current={current === 'activity' ? 'page' : undefined}
        >
          <HeartIcon />
          ファン活動
        </Link>
      </div>
    </nav>
  );
}
