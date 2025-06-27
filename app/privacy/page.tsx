'use client';

import { FC } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import Footer from 'app/components/Footer';
import Link from 'next/link';

const PrivacyPolicy: FC = () => {
  return (
    <>
      <Head>
        <title>プライバシーポリシー - Procom</title>
        <meta name="description" content="Procomのプライバシーポリシーページ" />
      </Head>

      <Header />

      <main className="bg-[#f7f7f7] text-[#333] py-10 px-5 min-h-screen">
        <section className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
          <h1 className="text-3xl font-bold text-center mb-6 text-[#1f1f2e]">プライバシーポリシー</h1>

          <p className="mb-6">
            Procom（以下「当サイト」といいます）は、利用者のプライバシー保護に最大限の注意を払い、
            以下の方針に基づいて個人情報を取り扱います。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">1. 収集する情報</h2>
          <p className="mb-2">当サイトでは、以下の情報を収集する場合があります：</p>
          <ul className="list-disc pl-6 space-y-1 mb-6">
            <li>ユーザー登録時の名前、メールアドレス、パスワード</li>
            <li>SNSアカウントのリンクやプロフィール情報</li>
            <li>アップロードされた画像・イベント情報等の入力内容</li>
            <li>アクセス解析のためのCookie情報</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">2. 情報の利用目的</h2>
          <p className="mb-2">収集した情報は、以下の目的で利用します：</p>
          <ul className="list-disc pl-6 space-y-1 mb-6">
            <li>ユーザー本人確認、マイページ作成・管理</li>
            <li>サービスの改善や新機能開発</li>
            <li>不正アクセスの監視やセキュリティ確保</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">3. 情報の第三者提供</h2>
          <p className="mb-6">
            本人の同意がある場合または法令に基づく場合を除き、収集した情報を第三者に提供することはありません。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">4. セキュリティ</h2>
          <p className="mb-6">
            当サイトは、ユーザーの情報を安全に管理するため、適切なセキュリティ対策を講じています。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">5. プライバシーポリシーの変更</h2>
          <p className="mb-6">
            本ポリシーは必要に応じて変更されることがあります。重要な変更がある場合は、当サイト上で告知します。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">6. お問い合わせ</h2>
          <p>
            本ポリシーに関するお問い合わせは、
            <Link href="/help" className="text-blue-600 underline hover:text-blue-800">
              ヘルプページ
            </Link>
            よりご連絡ください。
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default PrivacyPolicy;
