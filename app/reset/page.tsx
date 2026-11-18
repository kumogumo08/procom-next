import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPage from './ResetPage';

export const metadata: Metadata = {
  title: 'パスワード再設定 - Procom',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <ResetPage />
    </Suspense>
  );
}
