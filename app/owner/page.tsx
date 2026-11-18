import type { Metadata } from 'next';
import { FC } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const title = '運営者情報 - Procom';
const description = 'Procomの運営責任者、所在地、運営開始日、お問い合わせ先を掲載しています。';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/owner' },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: 'https://procom.jp/owner',
    siteName: 'Procom（プロコム）',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Procom（プロコム）OGP画像' }],
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og-image.jpg'],
    site: '@Procom_next',
  },
};

const OwnerPage: FC = () => {
  return (
    <>
      <Header />

      <main className="bg-[#f7f7f7] text-[#333] py-10 px-5 leading-relaxed min-h-screen">
        <section className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
          <h1 className="text-3xl font-bold text-center text-[#1f1f2e] mb-8">運営者情報</h1>

          <p className="mb-6">
            当サイト「Procom」は、個人または小規模チームによって運営されており、
            クリエイター・パフォーマー・フリーランスの方々が自身の活動を発信・整理できる
            プラットフォームを提供しています。
          </p>

          <h2 className="text-2xl text-[#38385a] mt-8 mb-2 font-semibold">サイト名</h2>
          <p>Procom（プロコム）</p>

          <h2 className="text-2xl text-[#38385a] mt-8 mb-2 font-semibold">運営責任者</h2>
          <p>エビサワ タカシ</p>

          <h2 className="text-2xl text-[#38385a] mt-8 mb-2 font-semibold">お問い合わせ</h2>
          <p>
            ご不明点やお問い合わせは{' '}
            <Link href="/help" className="text-blue-600 underline">
              ヘルプページ
            </Link>{' '}
            またはお問い合わせフォームよりご連絡ください。
          </p>

          <h2 className="text-2xl text-[#38385a] mt-8 mb-2 font-semibold">所在地</h2>
          <p>東京都内（詳細はお問い合わせに応じて開示）</p>

          <h2 className="text-2xl text-[#38385a] mt-8 mb-2 font-semibold">運営開始日</h2>
          <p>2025年5月</p>

          <h2 className="text-2xl text-[#38385a] mt-8 mb-2 font-semibold">目的</h2>
          <p>
            本サイトは、YouTuber、インスタグラマー、ダンサー、フリーランスなど個人で活動するユーザーが、
            自分のSNSをまとめて紹介できるスペースを提供することを目的としています。
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default OwnerPage;
