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
            この利用規約（以下「本規約」といいます）は、Procom（以下「当サービス」といいます）の利用条件を定めるものです。ユーザーの皆さまは、本規約に同意いただいた上で当サービスをご利用ください。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第1条（適用）</h2>
          <p>本規約は、ユーザーと運営者との間のすべての関係に適用されるものとします。</p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第2条（禁止事項）</h2>
          <p>ユーザーは、以下の行為をしてはなりません。</p>
          <ul className="list-disc list-inside pl-4 mb-4">
            <li>他のユーザーまたは第三者の権利を侵害する行為</li>
            <li>虚偽の情報登録やなりすまし</li>
            <li>公序良俗に反する行為</li>
            <li>当サービスの運営を妨げる行為</li>
            <li>その他、運営者が不適切と判断する行為</li>
          </ul>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第3条（著作権）</h2>
          <p>
            ユーザーが投稿した内容の著作権は投稿者に帰属しますが、当サービスは、当該コンテンツを当サービスの運営や広報に使用できるものとします。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第4条（免責事項）</h2>
          <ul className="list-disc list-inside pl-4 mb-4">
            <li>当サービスに掲載された情報の正確性は保証されません。</li>
            <li>ユーザー同士のトラブルについて、運営者は一切の責任を負いません。</li>
          </ul>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第5条（サービスの変更・終了）</h2>
          <p>当サービスは、予告なく内容の変更または提供の終了を行うことがあります。</p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第6条（退会）</h2>
          <p>ユーザーは、所定の方法によりいつでも退会することができます。退会後のデータは原則として削除されます。</p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第7条（準拠法・裁判管轄）</h2>
          <p>本規約の解釈にあたっては、日本法を準拠法とします。万が一紛争が生じた場合には、運営者の所在地を管轄する裁判所を専属的合意管轄とします。</p>

          <p className="text-right text-sm text-gray-500 mt-12">
            最終更新日：2025年6月
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default TermsPage;
