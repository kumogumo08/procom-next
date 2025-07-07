// ✅ app/top/page.tsx
import ClientUserList from './ClientUserList';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import styles from './top.module.css';

export const metadata = {
  title: 'Procom - あなたのSNS・プロフィール・活動情報を一つにまとめる自己発信プラットフォーム。',
  description: 'Procomは、YouTuberやダンサー、インフルエンサーのためのSNSプロフィール集約サイトです。',
  openGraph: {
    title: 'Procom - あなたのSNSをまとめよう',
    description: 'YouTube・X・Instagram・TikTokを一つのページで表示。',
    url: 'https://procom-next.onrender.com/top',
    siteName: 'Procom',
    images: [
      {
        url: 'https://procom-next.onrender.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ProcomのOG画像',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procom',
    description: 'SNSプロフィールをまとめて表示できるプラットフォーム。',
    images: ['https://procom-next.onrender.com/og-image.jpg'],
  },
};

export default function TopPage() {
  return (
    <>
      <Header />
      <ClientUserList /> {/* クライアント側でユーザー一覧をフェッチして表示 */}
      <Footer />
    </>
  );
}
