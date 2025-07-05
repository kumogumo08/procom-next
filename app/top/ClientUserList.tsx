// ✅ app/top/ClientUserList.tsx
'use client';

import { useEffect, useState } from 'react';
import styles from './top.module.css';

interface UserProfile {
  name?: string;
  title?: string;
  photos?: { url: string }[];
}

interface User {
  uid?: string;
  username?: string;
  name?: string;
  title?: string;
  profile?: UserProfile;
}

export default function ClientUserList() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/users');
        const usersData = await userRes.json();
        const randomUsers = usersData.sort(() => 0.5 - Math.random()).slice(0, 6);
        setUsers(randomUsers);
      } catch (err) {
        console.error('❌ ユーザー取得エラー:', err);
      }
    };
    fetchData();
  }, []);

  return (
    <section className={styles.userList}>
      {users.map((user, index) => {
        const name = user.profile?.name || user.name || user.username || '未設定';
        const title = user.profile?.title || user.title || '';
        const photoUrl = user.profile?.photos?.[0]?.url || 'https://via.placeholder.com/200x150?text=No+Image';
        const uid = user.uid || user.username;

        return (
          <div className={styles.userCard} key={index}>
            <a href={`/user/${uid}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <img src={photoUrl} alt={`${name}の写真`} />
              <div style={{ marginTop: '10px' }}>
                <strong>{name}</strong>
                <p>{title}</p>
              </div>
            </a>
          </div>
        );
      })}
    </section>
  );
}
