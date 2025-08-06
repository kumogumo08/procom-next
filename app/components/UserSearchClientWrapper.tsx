'use client';

import { useEffect, useRef, useState } from 'react';

type User = {
  uid: string;
  profile: {
    name: string;
    title?: string;
    photos?: { url: string }[];
  };
};

export default function UserSearchClientWrapper() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadMoreUsers();
  }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [loaderRef, hasMore]);

  const loadMoreUsers = async () => {
    try {
      const res = await fetch(`/api/users?page=${page}`);
      const data = await res.json();

      if (!data.users || data.users.length === 0) {
        setHasMore(false);
        return;
      }

      setUsers((prev) => [...prev, ...data.users]);
    } catch (err) {
      console.error('ユーザーの取得に失敗:', err);
      setHasMore(false);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
      {users.map((user) => (
        <div key={user.uid} className="bg-white shadow-md rounded p-4">
          <img
            src={user.profile.photos?.[0]?.url || '/noimage.jpg'}
            alt={user.profile.name}
            className="w-full h-40 object-cover rounded"
          />
          <h3 className="mt-2 font-bold text-center">{user.profile.name}</h3>
          <p className="text-sm text-center text-gray-600">{user.profile.title}</p>
        </div>
      ))}

      {/* 無限スクロール判定用ダミー要素 */}
      {hasMore && <div ref={loaderRef} className="h-10 col-span-full" />}
    </div>
  );
}
