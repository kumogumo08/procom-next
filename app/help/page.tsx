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

          {/* ▼ Procomの基本的な使い方 */}
        <h2 className="text-xl font-semibold mt-10 mb-4 text-[#38385a]">Procomの使い方</h2>
        <ul className="list-disc pl-6 space-y-4 mb-8">
          <li>
            <strong>プロフィールを作成・編集するには？</strong><br />
            → ログイン後、「プロフィール編集」ボタンから名前・肩書き・紹介文・写真・SNSリンクを編集できます。
          </li>
          <li>
            <strong>写真は何枚まで登録できますか？</strong><br />
            → 最大5枚までアップロードできます。ファイル形式は jpg / png / webp に対応しています。
          </li>
          <li>
            <strong>保存した情報は誰が見られますか？</strong><br />
            → 誰でも見られるプロフィールページになります。
          </li>
        </ul>

        {/* ▼ 推しボタンなどの追加機能 */}
        <h2 className="text-xl font-semibold mt-10 mb-4 text-[#38385a]">便利な機能について</h2>
        <ul className="list-disc pl-6 space-y-4 mb-8">
          <li>
            <strong>「推しボタン」とは？</strong><br />
            → 1日5回まで「応援」できるボタンです。気に入ったプロフィールに「推し」を送って気持ちを伝えましょう！
          </li>
          <li>
            <strong>バナーリンクの使い方</strong><br />
            → SHOPや公式サイトなどにリンク付きバナーを3件まで登録できます。画像とリンクを組み合わせてアピールしましょう。
          </li>
          <li>
            <strong>QRコードとは？</strong><br />
            → 自分のプロフィールページのQRコードを自動生成できます。イベントのフライヤーや名刺に活用できます。
          </li>
        </ul>

        {/* ▼ 技術的なエラーや不具合への対処 */}
        <h2 className="text-xl font-semibold mt-10 mb-4 text-[#38385a]">技術的なエラーへの対処</h2>
        <ul className="list-disc pl-6 space-y-4 mb-8">
          <li>
            <strong>Instagramが表示されない</strong><br />
            → 投稿URLを入力後、自動で表示されます。表示されない場合はURLの形式が正しいかご確認ください。
          </li>
          <li>
            <strong>保存した写真が反映されない</strong><br />
            → 通信状況やブラウザキャッシュの影響があるかもしれません。一度ログアウト・再ログインをお試しください。
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
