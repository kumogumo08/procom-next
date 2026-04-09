// ✅ TOP：流入 LP（ヒーロー UI は TopLandingHero、背景は heroStrip + topHeroBackground）

import Link from 'next/link';

import Footer from '@/components/Footer';
import NewsList from '@/components/NewsList';
import TopSpotlightUsers from '@/components/TopSpotlightUsers';
import TopLandingBento from './TopLandingBento';
import TopLandingHero from './TopLandingHero';

import styles from './top.module.css';

export const metadata = {
  title: 'Procom（プロコム） - SNS・プロフィール・リンク集を1ページに集約',
  description:
    'クリエイター向けのプロフィールページ。SNSと実績をひとつのURLに。無料で始められます。',
  openGraph: {
    title: 'Procom（プロコム） - あなたの活動を、1ページに',
    description:
      'SNSと実績を、ひとつのURLに。検索から見つかり、動画や写真で活動を見せられます。',
    url: 'https://procom.jp/top',
    siteName: 'Procom（プロコム）',
    images: [
      {
        url: 'https://procom.jp/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Procom（プロコム）のOG画像 - SNS・プロフィール・リンク集',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procom（プロコム） - あなたの活動を、1ページに',
    description: 'SNSと実績を、ひとつのURLに。',
    images: ['https://procom.jp/og-image.jpg'],
  },
};

export default function TopPage() {
  return (
    <main className={styles.page}>
      <div className={`${styles.heroStrip} ${styles.topHeroBackground}`}>
        <TopLandingHero />
      </div>

      <TopSpotlightUsers />

      <section className={styles.aboutSection} aria-labelledby="about-heading">
        <div className={styles.aboutInner}>
          <h2 id="about-heading" className={styles.aboutTitle}>
            Procomとは
          </h2>
          <p className={styles.aboutOneLiner}>
            発信の入口をひとつにまとめる、クリエイター向けプロフィールサービスです。
          </p>
          <div className={styles.aboutPoints}>
            <p className={styles.aboutPoint}>
              <span className={styles.aboutPointIcon} aria-hidden />
              プロフィール・SNS・写真や動画を、好きな順で並べられる
            </p>
            <p className={styles.aboutPoint}>
              <span className={styles.aboutPointIcon} aria-hidden />
              検索・一覧から、新しいファンや仕事の相手に見つけてもらえる
            </p>
            <p className={styles.aboutPoint}>
              <span className={styles.aboutPointIcon} aria-hidden />
              国内向けの表示で、スマホからも更新しやすい
            </p>
          </div>
        </div>
      </section>

      <TopLandingBento />

      <section className={styles.ctaSection} aria-labelledby="cta-heading">
        <div className={styles.ctaInner}>
          <h2 id="cta-heading" className={styles.ctaTitle}>
            無料で、あなたのページを作る
          </h2>
          <Link href="/login?mode=register" className={styles.ctaBtn}>
            無料ではじめる
          </Link>
          <p className={styles.ctaSub}>
            アカウントをお持ちの方は <Link href="/login">ログイン</Link>
          </p>
        </div>
      </section>

      <div className={styles.newsWrap}>
        <NewsList />
      </div>

      <Footer />
    </main>
  );
}
