import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'お気に入り - Procom',
};

export default function FavoritesPage() {
  return (
    <>
      <Header />
      <main style={{ padding: '24px 20px', maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: 12 }}>お気に入り</h1>
        <p style={{ lineHeight: 1.7, color: '#444' }}>
          現在、この機能はご利用いただけません。
        </p>
      </main>
      <Footer />
    </>
  );
}
