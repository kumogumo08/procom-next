import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UserSearchClientWrapper from '@/components/UserSearchClientWrapper'; // ✅ ここ

export default function UsersPage() {
  return (
    <>
      <Header />
      <main style={{ padding: '20px' }}>
        <UserSearchClientWrapper /> {/* ✅ クエリを渡すラッパー */}
      </main>
      <Footer />
    </>
  );
}
