import { Suspense } from 'react';
import ResetPage from './ResetPage';

export default function Page() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <ResetPage />
    </Suspense>
  );
}
