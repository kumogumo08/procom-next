// ✅ ファイル: app/top/TopPageClient.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ClientUserList from './ClientUserList';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function TopPageClient() {
  const router = useRouter();

  useEffect(() => {
    const lastUrl = localStorage.getItem('lastVisitedUrl');
    const isValidLastUrl =
      lastUrl &&
      lastUrl.startsWith('/user/') &&
      lastUrl !== '/top' &&
      !lastUrl.startsWith('/login');

    if (isValidLastUrl) {
      router.replace(lastUrl);
    }
  }, []);

  return (
    <>
      <Header />
      <ClientUserList />
      <div className="text-center mt-8">
      <Link
        href="/users"
        className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        登録者一覧を見る
      </Link>
    </div>
      <Footer />
    </>
  );
}
