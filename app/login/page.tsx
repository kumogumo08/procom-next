import { Suspense } from 'react';
import LoginPage from './LoginPage';

export default function Page() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <LoginPage />
    </Suspense>
  );
}
