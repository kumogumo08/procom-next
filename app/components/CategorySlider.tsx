'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type User = {
  uid: string;
  profile: {
    name: string;
    title?: string;
    photos?: { url: string }[];
  };
};

export default function CategorySlider({
  title,
  category,
  icon,
}: {
  title: string;
  category: string;
  icon?: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`/api/category-users?category=${category}`);
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error('ユーザー取得に失敗:', err);
      }
    };

    fetchUsers();
  }, [category]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const card = scrollRef.current.querySelector('.user-card') as HTMLElement;
      const scrollAmount = card ? card.offsetWidth + 16 : 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!users.length) return null;

  return (
    <section className="my-10">
      <h2 className="text-xl font-bold mb-4 text-center">
        {icon} {title}
      </h2>

      <div className="relative">
        {/* ← 矢印 */}
        <button
        onClick={() => scroll('left')}
        className="
            absolute 
            left-2 sm:left-0
            top-[70%] sm:top-1/2
            -translate-y-1/2 
            z-10 
            bg-white shadow p-2 sm:p-2 
            rounded-full hover:bg-gray-100
            text-xl sm:text-2xl
        "
        aria-label="左へスクロール"
        >
          ◀
        </button>

        {/* スクロールエリア */}
        <div
        ref={scrollRef}
        className="flex overflow-x-auto scroll-smooth scrollbar-hide space-x-4 px-0 sm:px-8 pb-2 max-w-screen-xl mx-auto"
        >
        {users.map((user) => (
            <Link
            key={user.uid}
            href={`/user/${user.uid}`}
            className="user-card flex-shrink-0 w-40 sm:w-48 md:w-56 bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
            <img
                src={user.profile.photos?.[0]?.url || '/procom.png'}
                alt={`${user.profile.name}の写真`}
                className="w-full h-40 object-cover"
            />
            <div className="p-2 text-sm text-center">
                <div className="font-bold truncate">{user.profile.name}</div>
                <div className="text-gray-600 truncate">{user.profile.title || '未設定'}</div>
            </div>
            </Link>
        ))}
        </div>
        {/* → 矢印 */}
        <button
        onClick={() => scroll('right')}
        className="
            absolute 
            right-2 sm:right-0
            top-[70%] sm:top-1/2
            -translate-y-1/2 
            z-10 
            bg-white shadow p-2 sm:p-2 
            rounded-full hover:bg-gray-100
            text-xl sm:text-2xl
        "
        aria-label="右へスクロール"
        >
          ▶
        </button>
      </div>
    </section>
  );
}
