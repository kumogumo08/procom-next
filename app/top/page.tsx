// ✅ ファイル: app/top/page.tsx（サーバーコンポーネント）

import TopPageClient from './TopPageClient';

export const metadata = {
  title: 'Procom（プロコム） - SNS・プロフィール・リンク集を1ページに集約',
  description:
    'Procom（プロコム）は、YouTuber・ダンサー・インフルエンサーのためのSNSリンク集＆プロフィール集約プラットフォーム。自分の発信活動をまとめて見せよう。',
  openGraph: {
    title: 'Procom（プロコム） - SNS・プロフィール・リンク集をまとめよう',
    description:
      'YouTube・X・Instagram・TikTokなどのSNSとプロフィールを1ページに集約。Procom（プロコム）であなたの魅力を伝えよう。',
    url: 'https://procom-next.onrender.com/top',
    siteName: 'Procom（プロコム）',
    images: [
      {
        url: 'https://procom-next.onrender.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Procom（プロコム）のOG画像 - SNS・プロフィール・リンク集',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procom（プロコム） - あなたのSNSとプロフィールをまとめよう',
    description:
      'SNSプロフィールをまとめて見せる自己発信プラットフォーム「Procom（プロコム）」。リンク集やプロフィールページが簡単に作れます。',
    images: ['https://procom-next.onrender.com/og-image.jpg'],
  },
};

export default function TopPage() {
  return <TopPageClient />;
}
