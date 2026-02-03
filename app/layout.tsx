// app/layout.tsx
import '../styles/globals.css';
import Analytics from './analytics';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プロフィール作成 & SNSリンク集なら Procom（プロコム）｜無料で1ページに集約',
  description:
    'Procom（プロコム）はプロフィール作成とSNSリンク集を無料で作れる国内サービス。写真スライダー・イベント告知・仕事依頼ボタンなど“魅せる”機能を1ページに集約。',
  metadataBase: new URL('https://procom.jp'),
  alternates: {
    canonical: 'https://procom.jp/',
  },
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'プロフィール作成 & SNSリンク集なら Procom（プロコム）',
    description:
      'プロフィール作成・リンクまとめ・リンクインバイオに最適。Procom（プロコム）は“魅せる”機能を備えた国内プラットフォームです。',
    url: 'https://procom.jp/',
    siteName: 'Procom（プロコム）',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Procom（プロコム）OGP画像' }],
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'プロフィール作成 & SNSリンク集なら Procom（プロコム）',
    description:
      'Procom（プロコム）はプロフィール作成とSNSリンク集を無料で作れる国内サービス。リンクまとめ・リンクインバイオにも最適。',
    images: ['/og-image.jpg'],
    site: '@Procom_next',
  },
  robots: {
    index: true, follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>

        {/* JSON-LD（WebSite + SearchAction + Organization） */}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Procom（プロコム）',
              url: 'https://procom.jp/',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://procom.jp/search?q={query}',
                'query-input': 'required name=query',
              },
              publisher: {
                '@type': 'Organization',
                name: 'Procom（プロコム）',
                url: 'https://procom.jp/',
                logo: {
                  '@type': 'ImageObject',
                  url: 'https://procom.jp/logo.png',
                },
                sameAs: [
                  'https://x.com/Procom_next',
                  // 他SNSがあれば追加
                ],
              },
              inLanguage: 'ja-JP',
            }),
          }}
        />

        {children}
      </body>
    </html>
  );
}
