import { Suspense } from 'react';

import UsersPageClient from './UsersPageClient';

export const metadata = {
  title: 'ユーザー検索・一覧 | Procom',
  description: 'Procomに登録されているユーザーを名前・肩書きで検索できます。',
};

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#555' }}>読み込み中…</div>
      }
    >
      <UsersPageClient />
    </Suspense>
  );
}
