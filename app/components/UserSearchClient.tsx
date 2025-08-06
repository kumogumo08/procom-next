'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface UserProfile {
  name?: string;
  title?: string;
  bio?: string;
  photos?: { url: string }[];
}

interface UserData {
  uid: string;
  profile: UserProfile;
}

export default function UserSearchClient({ initialQuery }: { initialQuery: string }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchValue, setSearchValue] = useState(initialQuery);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/users');
        const data = await res.json();

        const keyword = initialQuery.toLowerCase();
        const filtered = keyword
          ? data.filter((user: UserData) => {
              const name = user.profile?.name?.toLowerCase() || '';
              const title = user.profile?.title?.toLowerCase() || '';
              return name.includes(keyword) || title.includes(keyword);
            })
          : data;

        setUsers(data);
        setFilteredUsers(filtered);
      } catch (err) {
        console.error('ユーザーデータの取得に失敗しました', err);
        alert('ユーザーデータの取得に失敗しました');
      }
    }

    fetchUsers();
  }, [initialQuery]);


  const handleInput = (val: string) => {
    const lower = val.toLowerCase();
    setSearchValue(val);
    const result = users.filter((user) => {
      const name = user.profile?.name?.toLowerCase() || '';
      const title = user.profile?.title?.toLowerCase() || '';
      return name.includes(lower) || title.includes(lower);
    });
    setFilteredUsers(result);
  };

return (
  <div className="px-6 py-8">
    <input
      id="searchInput"
      type="text"
      placeholder="名前や肩書きで検索"
      value={searchValue}
      onChange={(e) => handleInput(e.target.value)}
      className="w-full p-3 border rounded mb-6 shadow-sm"
    />

    {filteredUsers.length === 0 ? (
      <p className="text-center text-gray-500">一致するユーザーが見つかりませんでした。</p>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredUsers.map((user) => {
          const name = user.profile?.name || '未設定';
          const title = user.profile?.title || '';
          const bio = user.profile?.bio || '';
          const photoUrl = user.profile?.photos?.[0]?.url || '/procom.png';

          return (
            <a
              key={user.uid}
              href={`/user/${user.uid}`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition duration-300 overflow-hidden"
            >
              <img
                src={photoUrl}
                alt={`${name}の写真`}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-lg font-bold text-center">{name}</h3>
                {title && <p className="text-sm text-center text-gray-600">{title}</p>}
                <p
                  className="text-sm text-gray-700 mt-2 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: bio.replace(/\n/g, '<br>') }}
                />
              </div>
            </a>
          );
        })}
      </div>
    )}
  </div>
);
}