// ✅ ファイル: app/top/TopPageClient.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ClientUserList from './ClientUserList';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TopPageClient() {
  const router = useRouter();

  useEffect(() => {
    const lastUrl = localStorage.getItem('lastVisitedUrl');
    if (lastUrl && lastUrl !== '/top' && !lastUrl.startsWith('/login')) {
      router.replace(lastUrl); // ✅ 自動リダイレクト
    }
  }, []);

  return (
    <>
      <Header />
      <ClientUserList />
      <Footer />
    </>
  );
}
