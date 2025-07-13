'use client';

import Head from 'next/head';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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

          <h2 className="text-xl font-semibold mt-8 mb-4 text-[#38385a]">よくある質問（FAQ）</h2>
          <ul className="list-disc pl-6 space-y-4 mb-8">
            <li>
              <strong>パスワードを忘れました</strong><br />
              → パスワード再設定機能をご利用いただけます。ログイン画面の「パスワードをお忘れの方はこちら」から手続きしてください。
            </li>
            <li>
              <strong>プロフィールが保存されません</strong><br />
              → 「プロフィールを保存」ボタンを押すことで保存できます。ログイン状態が解除されていないかもご確認ください。
            </li>
            <li>
              <strong>写真がうまく表示されません</strong><br />
              → 写真をアップロードした後、必ず「保存」を押してください。また画像サイズが大きすぎると失敗する場合があります。
            </li>
            <li>
              <strong>SNSリンク（YouTube・X・Instagram・TikTok）が反映されない</strong><br />
              → 正しい形式のURLを入力してください。保存後に表示されます。埋め込み対応していない形式には注意が必要です。
            </li>
            <li>
              <strong>「10の質問」ってなんですか？</strong><br />
              → 自己紹介を楽しく書くためのテンプレートです。プロフィール欄にワンクリックで挿入でき、あなたの個性を伝えるのに役立ちます。
            </li>
            <li>
              <strong>スマホでボタンが表示されない・押せない</strong><br />
              → 表示崩れや不具合の可能性があります。最新のブラウザで再読み込みしても改善しない場合は、スクリーンショットと併せてご連絡ください。
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">お問い合わせ</h2>
          <p className="mb-6">
            上記以外のお問い合わせは、以下のメールアドレスまでご連絡ください。<br />
            <strong>info@procom.jp</strong><br />
            できるだけ具体的な状況（エラー内容・ブラウザ・デバイス）をご記載ください。
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-2 text-[#38385a]">関連リンク</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <Link href="/privacy" className="text-blue-600 underline hover:text-blue-800">
                プライバシーポリシー
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-blue-600 underline hover:text-blue-800">
                利用規約
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
