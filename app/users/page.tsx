import { getRecentPublicUsers } from '@/lib/publicUsers';

import UsersPageClient from './UsersPageClient';

export const runtime = 'nodejs';

export const metadata = {
  title: 'ユーザー検索・一覧 | Procom',
  description: 'Procomに登録されているユーザーを名前・肩書きで検索できます。',
  alternates: {
    canonical: '/users',
  },
};

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = firstQueryValue((await searchParams).q).trim();
  const recentUsers = q ? [] : await getRecentPublicUsers();

  return <UsersPageClient q={q} recentUsers={recentUsers} />;
}
