'use client';

import Head from 'next/head';
import Header from '@/components/Header';
import Footer from '@/components/Footer'; // 位置が合っていればこのままでOK
import Link from 'next/link';
import type { JSX } from 'react';

export default function HelpPage(): JSX.Element {
  return (
    <>
      <Head>
        <title>ヘルプ - Procom</title>
        <meta name="description" content="Procomに関するヘルプ・FAQページ" />
      </Head>

      <Header />

      <main className="bg-[#f7f7f7] text-[#333] py-10 px-5 min-h-screen">
        <section className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
          <h1 className="text-3xl font-bold text-center mb-6 text-[#1f1f2e]">ヘルプ</h1>

          <h2 className="text-xl font-semibold mt-8 mb-4 text-[#38385a]">よくある質問</h2>
          <ul className="list-disc pl-6 space-y-4 mb-8">
            <li>
              <strong>パスワードを忘れました</strong><br />
              → 現在、パスワード再設定機能は開発中です。お困りの場合は運営までご連絡ください。
            </li>
            <li>
              <strong>プロフィールがうまく更新されません</strong><br />
              → 編集後は「プロフィールを保存」ボタンを押してください。保存できない場合は、ログイン状態をご確認ください。
            </li>
            <li>
              <strong>写真が反映されない／消える</strong><br />
              → 写真を登録後、保存ボタンを押してからページを再読み込みしてください。
            </li>
            <li>
              <strong>SNSリンクが表示されません</strong><br />
              → 入力欄に正しいURLを入力し、「表示」や「保存」ボタンを押してください。
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">お問い合わせ</h2>
          <p className="mb-6">
            その他のお問い合わせは、以下のメールアドレスまでご連絡ください。<br />
            <strong>info@procom.jp</strong>
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">関連リンク</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <Link href="/privacy" className="text-blue-600 underline hover:text-blue-800">
                プライバシーポリシー
              </Link>
            </li>
            <li>
              <Link href="/owner" className="text-blue-600 underline hover:text-blue-800">
                運営者情報
              </Link>
            </li>
            <li>
              <Link href="/withdraw" className="text-blue-600 underline hover:text-blue-800">
                退会方法
              </Link>
            </li>
          </ul>
        </section>
      </main>

      <Footer />
    </>
  );
}
