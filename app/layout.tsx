// ファイル: app/layout.tsx または app/layout.tsx に相当

import '../styles/globals.css';
import Analytics from './analytics';
import { Suspense } from 'react';
import Script from 'next/script'; 

export const metadata = {
  title: 'Procom',
  description: 'あなたのすべてを、ここに集約。SNSプロフィール集約プラットフォーム Procom',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Procom（プロコム）',
    description: 'SNSリンクを一括表示。あなたの情報を1ページに。',
    url: 'https://procom.jp',
    siteName: 'Procom',
    images: [
      {
        url: 'https://procom.jp/ogp-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Procom OGP画像',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procom',
    description: 'SNSプロフィールをまとめて表示できるプラットフォーム。',
    images: ['https://procom.jp/ogp-image.jpg'],
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
        <meta name="google-site-verification" content="t6Dm9fjYoVqLLPdklFeE6uNu_FzgB26c4f5eE3dqJ7A" />
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

        {/* ✅ 構造化データのScriptはここでOK！ */}
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Procom（プロコム）",
              url: "https://procom.jp",
              description: "フリーランス・クリエイターのためのプロフィール & SNSリンク集",
              publisher: {
                "@type": "Organization",
                name: "Procom",
              },
            }),
          }}
        />

        {children}
      </body>
    </html>
  );
}
