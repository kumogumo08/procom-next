'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type User = {
  uid: string;
  name: string;
  username: string;
  title: string;
  photoUrl?: string;
};

export default function UserListToggle() {
  const [showList, setShowList] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // ✅ セッション確認
    const checkSession = async () => {
      try {
        const res = await fetch('/api/session', { credentials: 'include' });
        const data = await res.json();
        setIsLoggedIn(data.loggedIn);
      } catch (err) {
        console.warn('⚠ セッション取得失敗', err);
        setIsLoggedIn(false);
      }
    };
    checkSession();
  }, []);

const toggleUserList = async () => {
  if (!loaded) {
    try {
      const res = await fetch('/api/favorites/users'); // ✅ API呼び出し
      const result = await res.json(); // ❗dataではなくresultに変更

      // ✅ users が配列か確認してから map
      const userArray = Array.isArray(result.users) ? result.users : [];

      const mapped = userArray.map((user: any) => ({
        uid: user.uid,
        username: user.username,
        name: user.name || user.username,
        title: user.title || '',
        photoUrl: user.photoUrl || '',
      }));

      setUsers(mapped);
      setLoaded(true);
    } catch (err) {
      console.error('お気に入りユーザー一覧取得失敗', err);
    }
  }
  setShowList(prev => !prev);
};

  if (!isLoggedIn) return null;

  return (
    <>
      {/* 🔼 トグルボタン */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <h3
          onClick={toggleUserList}
          style={{ cursor: 'pointer', color: '#ffffff', margin: 0 }}
        >
          {showList ? '▼ 登録ユーザー' : '▶ 登録ユーザー'}
        </h3>
      </div>

      {/* 🔽 ユーザー一覧パネル */}
      {showList && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 20,
            width: 280,
            maxHeight: 400,
            overflowY: 'auto',
            background: 'white',
            border: '1px solid #ccc',
            padding: 10,
            borderRadius: 8,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 9,
          }}
        >
          {users.length === 0 && <p>お気に入りはありません</p>}
          {users.map((user) => (
            <div key={user.uid} className="user-card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      marginRight: 10,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: '#ccc',
                      marginRight: 10,
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <strong>{user.name}</strong><br />
                  <small>{user.title}</small><br />
                  <Link href={`/user/${user.uid}`}>▶ プロフィール</Link>
                </div>

                {/* ❌ 削除ボタン */}
                <button
                  onClick={async () => {
                    if (!confirm(`「${user.name}」をお気に入りから削除しますか？`)) return;

                    const res = await fetch('/api/favorites/users',{
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ targetUid: user.uid }),
                    });

                    if (res.ok) {
                      setUsers(prev => prev.filter(u => u.uid !== user.uid));
                    } else {
                      alert('削除に失敗しました');
                    }
                  }}
                  style={{
                    marginLeft: 8,
                    background: 'transparent',
                    border: 'none',
                    color: '#d32f2f',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                  }}
                  title="お気に入りから削除"
                >
                  ❌
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
