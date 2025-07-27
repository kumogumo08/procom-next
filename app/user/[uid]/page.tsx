export const runtime = 'nodejs';

import React from 'react';
import { getProfileFromFirestore } from '@/lib/getProfile';
import { getSessionServer } from '@/lib/getSessionServer';
import Header from '@/components/Headerlogin';
import Footer from '@/components/Footer';
import UserPhotoSliderClient from '@/components/UserPhotoSliderClient';
import AuthUI from '@/components/AuthUI';
import UserProfileSection from '@/components/UserProfileSection';
import UserPageClient from '@/components/UserPageClient';
import YouTubeEmbedBlock from '@/components/YouTubeEmbedBlock';
import XEmbed from '@/components/XEmbed';
import InstagramEmbed from '@/components/InstagramEmbed';
import TikTokEmbed from '@/components/TikTokEmbed';
import FacebookEmbedBlock from '@/components/FacebookEmbedBlock';
import QRCodeBlock from '@/components/QRCodeBlock';
import OshiButton from '@/components/OshiButton';
import Script from 'next/script';
import XShareButton from '@/components/XShareButton';
import BannerLinksBlock from '@/components/BannerLinksBlock';
import UserPageClientWrapper from '@/components/UserPageClientWrapper';
import type { JSX } from 'react';
import type { Metadata } from 'next';

type PageProps = {
  params: {
    uid: string;
  };
};

export function generateMetadata({ params }: { params: { uid: string } }): Metadata {
  const { uid } = params;

  return {
    title: `Procom | ${uid} さんのプロフィール`,
    description: 'SNSプロフィールとリンク集をまとめたページ',
    openGraph: {
      title: `Procom | ${uid} さんのプロフィール`,
      description: 'SNSプロフィールとリンク集をまとめたページ',
      url: `https://procom-next.onrender.com/user/${uid}`,
      images: [
        {
          url: 'https://procom-next.onrender.com/og-image.jpg',
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Procom | ${uid} さんのプロフィール`,
      description: 'SNSプロフィールとリンク集をまとめたページ',
      images: ['https://procom-next.onrender.com/og-image.jpg'],
    },
  };
}

export default async function UserPage({ params }: { params: { uid: string } }) {
  const { uid } = params;
  const session = await getSessionServer();
  const isEditable = session?.uid === uid;
  const profile = await getProfileFromFirestore(uid);

  const photos = (profile?.photos || []).map((p: any) =>
    typeof p === 'string' ? { url: p, position: '50' } : { url: p.url, position: p.position ?? '50' }
  );

  const sectionOrder: string[] =
    profile?.settings?.sectionOrder ?? [
      'YouTube',
      'X',
      'Instagram',
      'TikTok',
      'Facebook',
      'BannerLinks',
      'SNSButtons',
    ];

  const sectionMap: Record<string, JSX.Element> = {
    YouTube: <YouTubeEmbedBlock uid={uid} isEditable={isEditable} />,
    X: <XEmbed uid={uid} isEditable={isEditable} />,
    Instagram: <InstagramEmbed uid={uid} isEditable={isEditable} />,
    TikTok: <TikTokEmbed uid={uid} isEditable={isEditable} />,
    Facebook: <FacebookEmbedBlock uid={uid} isEditable={isEditable} />,
    BannerLinks: <BannerLinksBlock uid={uid} isEditable={isEditable} />,
    SNSButtons: (
      <UserPageClientWrapper
        uid={uid}
        profile={profile}
        isEditable={isEditable}
      />
    ),
  };

  function renderSections(order: string[]) {
    const result: JSX.Element[] = [];

    const is1Col = (key: string) =>
      key === 'X' || key === 'Instagram' || key === 'Facebook' || key === 'BannerLinks';

    const is2Col = (key: string) =>
      key === 'YouTube' || key === 'TikTok' || key === 'SNSButtons';

    for (let i = 0; i < order.length; i++) {
      const curr = order[i];
      const next = order[i + 1];

      // 1カラム要素が連続している場合（横並びにする）
      if (is1Col(curr) && is1Col(next)) {
        result.push(
          <div className="sns-container" key={`group-${i}`}>
            <div className="sns-box">{sectionMap[curr]}</div>
            <div className="sns-box">{sectionMap[next]}</div>
          </div>
        );
        i++; // skip next
      }

      // 単独の1カラム要素（中央に表示）
      else if (is1Col(curr)) {
        result.push(
          <div className="sns-container" key={curr}>
            <div className="sns-box">{sectionMap[curr]}</div>
          </div>
        );
      }

      // 2カラム要素（単体で中央表示）
      else if (is2Col(curr)) {
        result.push(
          <div className="single-column-wrapper" key={curr}>
            {sectionMap[curr]}
          </div>
        );
      }
    }

    return result;
  }

  return (
    <>
      <Header />
      {profile?.name && (
        <h1
          style={{
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '1.8rem',
            margin: '1em 0',
          }}
        >
          {profile.name}さんのプロフィールページ
        </h1>
      )}

      <main>
        <UserPhotoSliderClient uid={uid} initialPhotos={photos} />
        <OshiButton uid={uid} />
        <XShareButton uid={uid} name={profile?.name} />
        <UserProfileSection uid={uid} isEditable={isEditable} />
        <UserPageClient uid={uid} profile={profile} isEditable={isEditable} />

        {renderSections(sectionOrder)}

        <QRCodeBlock />
      </main>

      <Footer />

      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
        strategy="afterInteractive"
      />
      <Script src="https://www.tiktok.com/embed.js" strategy="afterInteractive" />
      <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" />
    </>
  );
}
