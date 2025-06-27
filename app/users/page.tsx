// ✅ app/users/page.tsx
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UserSearchClient from '@/components/UserSearchClient';

export default function UsersPage() {
  return (
    <>
      <Header />
      <main style={{ padding: '20px' }}>
        <UserSearchClient />
      </main>
      <Footer />
    </>
  );
}
