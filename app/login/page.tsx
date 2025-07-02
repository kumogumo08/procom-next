// app/login/page.tsx
import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function Page() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <LoginClient />
    </Suspense>
  );
}
