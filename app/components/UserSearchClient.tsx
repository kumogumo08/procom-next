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
    <div style={{ padding: '20px' }}>
      <input
        id="searchInput"
        type="text"
        placeholder="名前や肩書きで検索"
        value={searchValue}
        onChange={(e) => handleInput(e.target.value)}
        style={{ padding: '10px', width: '100%', marginBottom: '20px' }}
      />
      <div id="userList">
        {filteredUsers.length === 0 ? (
          <p>一致するユーザーが見つかりませんでした。</p>
        ) : (
          filteredUsers.map((user) => {
            const name = user.profile?.name || '未設定';
            const title = user.profile?.title || '';
            const bio = user.profile?.bio || '';
            const photoUrl = user.profile?.photos?.[0]?.url;

            return (
              <a
                key={user.uid}
                href={`/user/${user.uid}`}
                className="user-card"
                style={{
                  display: 'block',
                  padding: '10px',
                  borderBottom: '1px solid #ccc',
                  textDecoration: 'none',
                  color: 'inherit',
                  marginBottom: '10px',
                }}
              >
                {photoUrl && (
                  <img
                    src={photoUrl}
                    alt={`${name}の写真`}
                    className="user-thumb"
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      marginRight: '10px',
                      float: 'left',
                    }}
                  />
                )}
                <h3>{name} {title ? `（${title}）` : ''}</h3>
                <p dangerouslySetInnerHTML={{ __html: bio.replace(/\n/g, '<br>') }}></p>
                <div style={{ clear: 'both' }}></div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
