// app/users/page.tsx
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UserSearchClientWrapper from '@/components/UserSearchClientWrapper';
import { Suspense } from 'react';

export default function UsersPage() {
  return (
    <>
      <Header />
      <main style={{ padding: '20px' }}>
        <Suspense fallback={<div>読み込み中...</div>}>
          <UserSearchClientWrapper />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
