'use client';

import { useSearchParams } from 'next/navigation';
import UserSearchClient from './UserSearchClient'; // ← 検索処理を行うコンポーネント

export default function UserSearchClientWrapper() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  return <UserSearchClient initialQuery={query} />;
}
