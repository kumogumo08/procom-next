import Image from 'next/image';
import Link from 'next/link';

import styles from './top.module.css';

const PROFILE_WIDTH = 1672;
const PROFILE_HEIGHT = 941;

/** 本番の EBI Dev Lab プロフィール。https://procom.jp/user/1vgpGoKH18SLlXs6YGQ0IWywNO62 */
const SAMPLE_PROFILE_HREF = '/user/1vgpGoKH18SLlXs6YGQ0IWywNO62';

export default function TopLandingVisual() {
  return (
    <div className={styles.heroVisual}>
      <Image
        src="/images/top/hero-profile.webp"
        alt="スマートフォンとパソコンに表示されたProcomのプロフィール画面。SNS、アプリ、動画、イベントなどを紹介できます"
        width={PROFILE_WIDTH}
        height={PROFILE_HEIGHT}
        sizes="(max-width: 767px) 92vw, 880px"
        priority
        fetchPriority="high"
        className={styles.heroVisualImg}
        style={{ width: '100%', height: 'auto' }}
      />
      <Link href={SAMPLE_PROFILE_HREF} className={styles.heroVisualLink}>
        実際のプロフィールを見る
      </Link>
    </div>
  );
}
