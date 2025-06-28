// src/components/UserSearchClientWrapper.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import UserSearchClient from './UserSearchClient';

export default function UserSearchClientWrapper() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  return <UserSearchClient initialQuery={query} />;
}
