//app/user/[uid]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import Script from 'next/script';
import Header from '@/components/Headerlogin';
import Footer from '@/components/Footer';
import PhotoSliderBlock from '@/components/PhotoSliderBlock';
import AuthUI from '@/components/AuthUI';
import { use } from 'react';
import { createCalendar, events } from '@/lib/calendar';
import ProfileEditor from '@/components/ProfileEditor';
import UserListToggle from '@/components/UserListToggle';
import CalendarBlock from '@/components/CalendarBlock';
import YouTubeEmbedBlock from '@/components/YouTubeEmbedBlock';
import type { Photo } from '@/types';
import XEmbed from '@/components/XEmbed';
import InstagramEmbed from '@/components/InstagramEmbed';
import TikTokEmbed from '@/components/TikTokEmbed';
import QRCodeBlock from '@/components/QRCodeBlock';
import UserProfileSection from '@/components/UserProfileSection';
import UserPageClient from '@/components/UserPageClient';
import FacebookEmbedBlock from '@/components/FacebookEmbedBlock';
import OshiButton from '@/components/OshiButton';

export default function UserPage(props: { params: Promise<{ uid: string }> }) {
  const params = use(props.params);
  const { uid } = params;

  const [showUserList, setShowUserList] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [current, setCurrent] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [session, setSession] = useState<{ loggedIn: boolean; uid?: string } | null>(null);

  const handlePositionChange = (index: number, value: string) => {
    setPhotos(prev =>
      prev.map((photo, i) => (i === index ? { ...photo, position: value } : photo))
    );
  };

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const res = await fetch(`/api/user/${uid}`);
        if (!res.ok) throw new Error('ユーザー情報の取得に失敗しました');
        const data = await res.json();
        const arr = (data.profile?.photos || []).map((p: any) =>
          typeof p === 'string'
            ? { url: p, position: '50' }
            : { url: p.url, position: p.position ?? '50' }
        );
        setPhotos(arr);
        setCurrent(0);
      } catch (e) {
        setPhotos([]);
      }
    }

    async function checkSession() {
      const res = await fetch('/api/session', {
      credentials: 'include',
    });
      const data = await res.json();
      setSession(data); 
      if (data.loggedIn && data.uid === uid) {
        document.body.classList.add('own-page');
      } else {
        document.body.classList.remove('own-page');
      }
    }

    fetchPhotos();
    checkSession();
  }, [uid]);

  const isOwnPage = !!(session?.loggedIn && session.uid === uid);

  return (
    <>
        <Head>
          <title>{profile?.name ?? 'Procomユーザー'}さんのSNSプロフィール - Procom</title>
          <meta name="description" content={`${profile?.name ?? 'このユーザー'}さん（${profile?.title ?? '登録ユーザー'}）のSNS、写真、予定、紹介などをまとめたプロフィールページです。`} />
          <meta property="og:title" content={`${profile?.name ?? 'Procomユーザー'} - Procomプロフィール`} />
          <meta property="og:description" content={profile?.bio ?? 'SNSリンクや自己紹介、写真を集約したProcomのプロフィールページです。'} />
          <meta property="og:type" content="profile" />
          <meta property="og:url" content={`https://procom-next.onrender.com/user/${uid}`} />
          <meta property="og:image" content={photos[0]?.url ?? '/og-image.jpg'} />
          <link rel="canonical" href={`https://procom-next.onrender.com/user/${uid}`} />
          <meta name="robots" content="index, follow" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="stylesheet" href="/style.css" />
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap" rel="stylesheet" />
        </Head>

      <Header />
    {/* ユーザー名表示 */}
    {profile?.name && (
      <h1 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.8rem', margin: '1em 0' }}>
        {profile.name}さんのプロフィールページ
      </h1>
    )}

      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <h3
          id="toggleUserList"
          style={{ cursor: 'pointer', color: '#ffffff', margin: 0 }}
          onClick={() => setShowUserList((v) => !v)}
        >
          ▶ 登録ユーザー
        </h3>
      </div>

      {showUserList && (
        <div
          id="userListContainer"
          style={{
            display: 'block', position: 'absolute', top: 60, left: 20, width: 280,
            maxHeight: 400, overflowY: 'auto', background: 'white',
            border: '1px solid #ccc', padding: 10, borderRadius: 8,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 9
          }}>
          <div id="userList" className="user-list"></div>
        </div>
      )}

      <main>
        <PhotoSliderBlock
          uid={uid}
          photos ={photos}
          setPhotos={setPhotos}
        />
          <OshiButton uid={uid} />
          <UserListToggle />
          <AuthUI />
          <UserProfileSection uid={uid} isEditable={session?.uid === uid} />
          <UserPageClient uid={uid} />
          <YouTubeEmbedBlock uid={uid} isEditable={session?.uid === uid} />
          <div className="sns-container">
          <div className="sns-box">
          <XEmbed uid={uid} isEditable={session?.uid === uid} />
          </div>
          <div className="sns-box">
          <InstagramEmbed uid={uid} isEditable={session?.uid === uid} />
          </div>
          </div>
          <TikTokEmbed uid={uid} isEditable={session?.uid === uid} />
          <FacebookEmbedBlock uid={uid} isEditable={isOwnPage} />
          <QRCodeBlock />

      </main>

      <Footer />

      <Script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js" strategy="afterInteractive" />
      <Script src="https://www.tiktok.com/embed.js" strategy="afterInteractive" />
      <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" />
      <Script src="https://www.instagram.com/embed.js" strategy="afterInteractive" />
      <script async src="https://www.instagram.com/embed.js"></script>
    </>
  );
}
