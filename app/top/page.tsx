'use client'; // ✅ クライアントコンポーネントとして指定

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ClientUserList from './ClientUserList';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import styles from './top.module.css';

export const metadata = {
  title: 'Procom（プロコム） - あなたのSNS・プロフィール・活動情報を一つにまとめる自己発信プラットフォーム。',
  description: 'Procom（プロコム）は、YouTuberやダンサー、インフルエンサーのためのSNSプロフィール集約サイトです。',
  openGraph: {
    title: 'Procom（プロコム） - あなたのSNSをまとめよう',
    description: 'YouTube・X・Instagram・TikTokを一つのページで表示。',
    url: 'https://procom-next.onrender.com/top',
    siteName: 'Procom（プロコム）',
    images: [
      {
        url: 'https://procom-next.onrender.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Procom（プロコム）のOG画像',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procom（プロコム）',
    description: 'SNSプロフィールをまとめて表示できるプラットフォーム「Procom（プロコム）」で、自分だけの発信ページを作ろう。',
    images: ['https://procom-next.onrender.com/og-image.jpg'],
  },
};

export default function TopPage() {
  const router = useRouter();

  useEffect(() => {
    const lastUrl = localStorage.getItem('lastVisitedUrl');
    if (lastUrl && lastUrl !== '/top' && !lastUrl.startsWith('/login')) {
      router.replace(lastUrl); // ✅ 自動リダイレクト（/loginなどは除外）
    }
  }, []);

  return (
    <>
      <Header />
      <ClientUserList />
      <Footer />
    </>
  );
}
