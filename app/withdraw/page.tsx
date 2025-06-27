'use client';

import { FC } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import Footer from 'app/components/Footer';
import Link from 'next/link';

const WithdrawPage: FC = () => {
  return (
    <>
      <Head>
        <title>退会方法 - Procom</title>
        <meta name="description" content="Procomからの退会手続きについてご案内します。" />
      </Head>

      <Header />

      <main className="bg-[#f7f7f7] text-[#333] py-10 px-5 min-h-screen">
        <section className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
          <h1 className="text-3xl font-bold text-center mb-6 text-[#1f1f2e]">退会方法について</h1>

          <p className="mb-6">
            Procomをご利用いただきありがとうございます。退会をご希望の場合は、以下の手順に従ってください。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">退会手順</h2>
          <ul className="list-disc pl-6 space-y-1 mb-6">
            <li>ログインした状態で、画面右上の「⚙ アカウント設定」をクリックします。</li>
            <li>「退会する」ボタンをクリックしてください。</li>
            <li>確認ダイアログが表示されますので、「退会する」を再度選択してください。</li>
          </ul>

          <p className="mb-6">
            退会後は、登録情報・プロフィール・SNSリンク・写真・予定などのすべてのデータが完全に削除されます。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">注意事項</h2>
          <p className="mb-6">
            一度退会すると、アカウントの復元はできませんのでご注意ください。再度ご利用いただく場合は、新規登録が必要です。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">お困りの場合</h2>
          <p>
            うまく退会できない場合や不明な点がある場合は、{' '}
            <Link href="/help">
              <span className="text-blue-600 underline hover:text-blue-800">ヘルプページ</span>
            </Link>{' '}
            よりご連絡ください。
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default WithdrawPage;
