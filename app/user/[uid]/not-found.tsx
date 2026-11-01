import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ページが見つかりません',
  robots: { index: false, follow: false },
};

export default function MissingProfile() {
  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.25rem', color: '#0f172a' }}>プロフィールが見つかりません</h1>
    </main>
  );
}
