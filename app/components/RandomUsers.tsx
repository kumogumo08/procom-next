'use client';

import { useEffect, useState } from 'react';

type User = {
  uid?: string;
  username?: string;
  name?: string;
  title?: string;
  photoUrl?: string;
  profile?: {
    name?: string;
    title?: string;
    photos?: { url: string }[];
  };
};

export default function RandomUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [session, setSession] = useState<{ loggedIn: boolean; uid?: string } | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        // 🔄 ユーザー一覧取得
        const res = await fetch('/api/users');
        const allUsers: User[] = await res.json();

        const randomUsers = allUsers.sort(() => 0.5 - Math.random()).slice(0, 6);
        setUsers(randomUsers);

        // 🔐 ログイン状態取得
        const sessionRes = await fetch('/api/session');
        const sessionData = await sessionRes.json();
        setSession(sessionData);
      } catch (err) {
        console.error('❌ 初期化エラー:', err);
      }
    }

    initialize();
  }, []);

  return (
    <>
      {/* 🔐 ログインUIの切り替え */}
      <nav style={{ textAlign: 'right', marginBottom: '10px' }}>
        {session?.loggedIn ? (
          <>
            <a id="mypage-link" href={`/user/${session.uid}`} style={{ marginRight: '10px' }}>
              マイページ
            </a>
            <a id="logout-link" href="/logout">
              ログアウト
            </a>
          </>
        ) : (
          <>
            <a id="login-link" href="/login" style={{ marginRight: '10px' }}>
              ログイン
            </a>
            <a id="register-link" href="/register">
              新規登録
            </a>
          </>
        )}
      </nav>

      {/* 🧑‍🤝‍🧑 ランダムユーザー表示 */}
      <div id="random-users" className="user-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {users.map((user, index) => {
          const name = user.profile?.name || user.name || user.username || '未設定';
          const title = user.profile?.title || user.title || '';
          const photoUrl =
            user.profile?.photos?.[0]?.url ||
            user.photoUrl ||
            'https://via.placeholder.com/200x150?text=No+Image';
          const uid = user.uid || user.username || `user${index}`;

          return (
            <div key={uid} className="user-card" style={{ width: '180px' }}>
              <a href={`/user/${uid}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <img
                  src={photoUrl}
                  alt={`${name}の写真`}
                  style={{ width: '100%', borderRadius: '8px' }}
                />
                <div style={{ marginTop: '10px' }}>
                  <strong>{name}</strong>
                  <p>{title}</p>
                </div>
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}
