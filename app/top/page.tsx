// ✅ ファイル: app/top/page.tsx（サーバーコンポーネント）

import TopPageClient from './TopPageClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CategorySlider from '@/components/CategorySlider';
import Link from 'next/link';
import NewsList from "@/components/NewsList";

export const metadata = {
  title: 'Procom（プロコム） - SNS・プロフィール・リンク集を1ページに集約',
  description:
    'Procom（プロコム）は、YouTuber・ダンサー・インフルエンサーのためのSNSリンク集＆プロフィール集約プラットフォーム。自分の発信活動をまとめて見せよう。',
  openGraph: {
    title: 'Procom（プロコム） - SNS・プロフィール・リンク集をまとめよう',
    description:
      'YouTube・X・Instagram・TikTokなどのSNSとプロフィールを1ページに集約。Procom（プロコム）であなたの魅力を伝えよう。',
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
    title: 'Procom（プロコム） - あなたのSNSとプロフィールをまとめよう',
    description:
      'SNSプロフィールをまとめて見せる自己発信プラットフォーム「Procom（プロコム）」。リンク集やプロフィールページが簡単に作れます。',
    images: ['https://procom.jp/og-image.jpg'],
  },
};

export default function TopPage() {
  return (
    <main>
      <Header />
      <CategorySlider title="ダンサー" category="ダンサー" icon="💃" />
      <CategorySlider title="YouTuber" category="youtuber" icon="🎥" />
      <CategorySlider title="新規登録者" category="new" icon="🆕" />
      <div className="text-center my-10">
        <Link
          href="/users"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          登録者一覧を見る
        </Link>
      </div>
        <div style={{ marginTop: "40px", marginBottom: "40px" }}>
        <NewsList />
      </div>
      <Footer />
    </main>
  );
}
