'use client';

import { FC } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import Footer from 'app/components/Footer';

const TermsPage: FC = () => {
  return (
    <>
      <Head>
        <title>利用規約 - Procom</title>
        <meta name="description" content="Procomの利用規約ページです" />
      </Head>

      <Header />

      <main className="bg-[#f4f4f8] text-[#333] py-10 px-5 min-h-screen">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6">利用規約</h1>

        <p className="mb-6">
          本利用規約（以下「本規約」といいます）は、Procom（以下「当サービス」といいます）の提供条件および利用者の皆さま（以下「ユーザー」）との関係を定めるものです。ユーザーは、本規約に同意のうえ、当サービスをご利用いただくものとします。
        </p>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第1条（適用）</h2>
        <p>
          本規約は、当サービスの提供条件およびユーザーとの間の一切の関係に適用されます。
        </p>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第2条（登録情報および表示内容）</h2>
        <p>
          ユーザーは、プロフィール・画像・SNSリンク・カレンダー情報等を当サービスに登録・表示することができます。登録された情報は、公開プロフィールとして他のユーザーに閲覧される可能性があることに同意するものとします。
        </p>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第3条（禁止事項）</h2>
        <p>ユーザーは、以下の行為を行ってはなりません。</p>
        <ul className="list-disc list-inside pl-4 mb-4">
          <li>虚偽の情報の登録、他者になりすます行為</li>
          <li>第三者の著作権・プライバシー権その他の権利を侵害する行為</li>
          <li>当サービスの運営を妨げる行為</li>
          <li>不正アクセスやデータの改ざん</li>
          <li>法令または公序良俗に反する行為</li>
        </ul>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第4条（コンテンツの著作権）</h2>
        <p>
          ユーザーが投稿・登録した文章・画像・SNSリンク等のコンテンツの著作権はユーザーに帰属します。ただし、当サービスは当該コンテンツを、サービスの運営・改善・広報のために無償で使用できるものとします。
        </p>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第5条（プライバシー・データの管理）</h2>
        <p>
          当サービスは、登録された個人情報を適切に取り扱い、外部への漏洩・不正アクセスの防止に努めます。詳細は別途定めるプライバシーポリシーに従います。
        </p>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第6条（サービス内容の変更・停止）</h2>
        <p>
          当サービスは、ユーザーに事前通知することなく、サービスの内容を変更・追加・中止・終了することができるものとします。
        </p>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第7条（退会とデータの削除）</h2>
        <p>
          ユーザーは、所定の方法で退会できます。退会後、原則として登録情報は削除されますが、運営上必要なバックアップや法令等に基づき一定期間保管される場合があります。
        </p>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第8条（免責事項）</h2>
        <ul className="list-disc list-inside pl-4 mb-4">
          <li>当サービスは、掲載情報の正確性・完全性を保証しません。</li>
          <li>ユーザー間のトラブルについて、運営者は一切責任を負いません。</li>
          <li>天災・通信障害などによるサービス停止に対して責任を負いません。</li>
        </ul>

        <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第9条（準拠法・裁判管轄）</h2>
        <p>
          本規約の解釈には日本法を準拠法とし、紛争が生じた場合には運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
        </p>

        <p className="text-right text-sm text-gray-500 mt-12">
          最終更新日：2025年6月27日
        </p>

        </div>
      </main>

      <Footer />
    </>
  );
};

export default TermsPage;
