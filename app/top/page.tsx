// ✅ app/top/page.tsx - 統合版（元の app/page.js の内容を反映）
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import Footer from 'app/components/Footer';
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

export default function TopPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/users');
        const usersData = await userRes.json();
        const randomUsers = usersData.sort(() => 0.5 - Math.random()).slice(0, 6);
        setUsers(randomUsers);

        const sessionRes = await fetch('/session');
        const sessionData = await sessionRes.json();
        setSession(sessionData);
      } catch (err) {
        console.error('❌ 初期化エラー:', err);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <Head>
        <title>Procom - あなたのSNS・プロフィール・活動情報を一つにまとめる自己発信プラットフォーム。</title>
        <meta name="description" content="Procomは、YouTuberやダンサー、インフルエンサーのためのSNSプロフィール集約サイトです。" />
        <meta property="og:title" content="Procom - あなたのSNSをまとめよう" />
        <meta property="og:description" content="YouTube・X・Instagram・TikTokを一つのページで表示。" />
        <meta property="og:image" content="https://procom-next.onrender.com/og-image.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <Header />

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

      <Footer />
    </>
  );
}
