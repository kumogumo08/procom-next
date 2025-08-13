// app/layout.tsx

import '../styles/globals.css';
import Analytics from './analytics';
import { Suspense } from 'react';
import Script from 'next/script';

export const metadata = {
  title: 'Procom（プロコム）｜SNSプロフィール＆リンク集プラットフォーム',
  description:
    'Procom（プロコム）は、あなたのSNSプロフィールとリンク集を1ページにまとめて魅力的に見せる無料サービス。フリーランス、YouTuber、インスタグラマー、ダンサーなど幅広いクリエイターに最適。',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Procom（プロコム）｜SNSプロフィール＆リンク集を1ページに',
    description:
      'Procom（プロコム）はSNSリンクを一括表示し、プロフィールを魅力的に見せるプラットフォーム。誰でも簡単にSNSリンク集が作成できます。',
    url: 'https://procom.jp/',
    siteName: 'Procom（プロコム）',
    images: [
      {
        url: 'https://procom.jp/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Procom（プロコム）OGP画像',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procom（プロコム）｜SNSプロフィール集約サービス',
    description:
      'Procom（プロコム）は、あなたのSNSリンクをまとめて1ページで表示できる無料プロフィール作成サービス。',
    images: ['https://procom.jp/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@Procom_next" />
        <meta name="twitter:title" content="Procom（プロコム）｜SNSプロフィール＆リンク集" />
        <meta
          name="twitter:description"
          content="Procom（プロコム）はSNSプロフィールとリンク集をまとめて1ページに表示できる無料プラットフォーム。"
        />
        <meta name="twitter:image" content="https://procom.jp/og-image.jpg" />

        <meta property="og:title" content="Procom（プロコム）｜SNSプロフィール集約" />
        <meta
          property="og:description"
          content="Procom（プロコム）はSNSリンクを一括表示し、魅力的なプロフィールページを簡単に作れるプラットフォーム。"
        />
        <meta property="og:image" content="https://procom.jp/og-image.jpg" />
        <meta property="og:url" content="https://procom.jp/" />
        <meta property="og:type" content="website" />

        <meta
          name="description"
          content="Procom（プロコム）は、あなたのSNSプロフィールとリンク集を1ページにまとめる無料サービス。フリーランス・クリエイター・インフルエンサーに最適。"
        />
        <meta name="google-site-verification" content="f6A-hc6jAwrweCHOaVCvsk0kyCukcP-BHebE9pCs2yo" />

        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>

        {/* 構造化データにカタカナを追加 */}
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Procom（プロコム）',
              url: 'https://procom.jp/',
              description:
                'Procom（プロコム）は、SNSプロフィールやリンク集をまとめて表示できる無料のプロフィールページ作成サービス。',
              publisher: {
                '@type': 'Organization',
                name: 'Procom（プロコム）',
              },
            }),
          }}
        />

        {children}
      </body>
    </html>
  );
}
