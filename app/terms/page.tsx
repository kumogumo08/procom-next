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
        <meta name="description" content="Procomの利用規約ページです。" />
      </Head>

      <Header />

      <main className="bg-[#f4f4f8] text-[#333] py-10 px-5 min-h-screen">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold mb-6">利用規約</h1>

          <p className="mb-6">
            本利用規約（以下「本規約」）は、Procom（以下「当サービス」）の提供条件および利用者（以下「ユーザー」）との間の権利義務関係を定めるものです。ユーザーは、本規約に同意のうえ、当サービスを利用するものとします。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第1条（適用）</h2>
          <p>
            本規約は、当サービスの提供に関し、ユーザーと当サービスとの間の全ての関係に適用されます。なお、当サービスが別途定める個別規定等がある場合は、それらも本規約の一部を構成するものとします。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第2条（登録情報・コンテンツの公開）</h2>
          <p>
            ユーザーは、プロフィール、画像、SNSリンク、カレンダー情報等のコンテンツを当サービスに登録・表示できます。登録された情報は、公開プロフィールとして他のユーザーが閲覧可能であることを、ユーザーは予め承諾するものとします。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第3条（禁止事項）</h2>
          <p>ユーザーは、以下の行為を行ってはなりません。</p>
          <ul className="list-disc list-inside pl-4 mb-4">
            <li>虚偽の情報を登録する行為</li>
            <li>他人になりすます行為</li>
            <li>他者の知的財産権、プライバシー権、肖像権などを侵害する行為</li>
            <li>当サービスの運営を妨げる行為</li>
            <li>無断での広告、勧誘、スパム行為</li>
            <li>違法・反社会的・公序良俗に反する行為</li>
          </ul>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第4条（著作権および使用権）</h2>
          <p>
            ユーザーが当サービス上で投稿・登録したコンテンツの著作権は、原則としてユーザーに帰属します。ただし、当サービスは、サービス運営・改善・プロモーションのために、ユーザーのコンテンツを無償で使用・編集・再掲載できる非独占的権利を有するものとします。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第5条（個人情報の取り扱い）</h2>
          <p>
            当サービスは、ユーザーの個人情報を適切に取り扱い、外部への漏洩・不正アクセス等を防止するために合理的な安全対策を講じます。詳細は別途定めるプライバシーポリシーに従います。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第6条（サービス内容の変更・停止等）</h2>
          <p>
            当サービスは、予告なくサービス内容を変更・追加・中止・終了できるものとします。これによりユーザーに損害が生じた場合でも、当サービスは一切の責任を負わないものとします。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第7条（退会と情報の削除）</h2>
          <p>
            ユーザーは、所定の手続により自由に退会することができます。退会後は、原則として登録されたプロフィール情報・画像・SNSリンク等は削除されます。ただし、バックアップや法的義務等により一定期間保存される場合があります。
          </p>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第8条（免責事項）</h2>
          <ul className="list-disc list-inside pl-4 mb-4">
            <li>当サービスは、掲載情報の正確性・有用性を保証するものではありません。</li>
            <li>ユーザー間または第三者との間で生じたトラブルについて、当サービスは一切の責任を負いません。</li>
            <li>自然災害、通信障害、システム障害等によるサービス停止やデータ損失に対して、責任を負いません。</li>
          </ul>

          <h2 className="text-xl font-semibold border-b border-gray-300 mt-8 mb-2">第9条（準拠法および管轄）</h2>
          <p>
            本規約の解釈にあたっては日本法を準拠法とし、当サービスとユーザーの間で紛争が生じた場合には、運営者所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
          </p>

          <p className="text-right text-sm text-gray-500 mt-12">
            最終更新日：2025年7月12日
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default TermsPage;
