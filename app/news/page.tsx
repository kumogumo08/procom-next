import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsList from '@/components/NewsList';

export const metadata = {
  title: 'お知らせ - Procom（プロコム）',
  description: 'Procomからのお知らせ・更新情報の一覧です。',
  alternates: {
    canonical: '/news',
  },
};

/** 一覧は公開NEWSを新しい順。件数上限は API / Firestore の実用上限（通常十分） */
const NEWS_LIST_LIMIT = 500;

export default function NewsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f7f7f7] py-10 px-5 text-[#333]">
        <div className="mx-auto w-full max-w-[960px]">
          <NewsList limit={NEWS_LIST_LIMIT} />
        </div>
      </main>
      <Footer />
    </>
  );
}
