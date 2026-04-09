export const runtime = 'nodejs';

import React from 'react';
import { getProfileFromFirestore } from '@/lib/getProfile';
import { getSessionServer } from '@/lib/getSessionServer';
import Header from '@/components/Headerlogin';
import Footer from '@/components/Footer';
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
import AppProjectBlock from '@/components/AppProjectBlock';
import { coerceAppsFromFirestore } from '@/lib/appProjects';
import type { JSX } from 'react';
import type { Metadata } from 'next';
import UserPageSectionsClient from '@/components/UserPageSectionsClient';
import { clampPhotoPositionY } from '@/lib/photoPosition';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uid: string }>;
}): Promise<Metadata> {
  const { uid } = await params;
  const profile = await getProfileFromFirestore(uid);
  const name = profile?.name || 'Procomユーザー';
  const bio = profile?.bio || 'SNSプロフィールとリンク集をまとめたページ';
  const photoUrl =
    profile?.photos?.[0]?.url || 'https://procom.jp/og-image.jpg';

  return {
    title: `${name} | Procom`,
    description: bio,
    openGraph: {
      title: `${name} | Procom`,
      description: bio,
      url: `https://procom.jp/user/${uid}`,
      siteName: 'Procom',
      images: [
        {
          url: photoUrl,
          width: 1200,
          height: 630,
          alt: `${name}さんのOGP画像`,
        },
      ],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | Procom`,
      description: bio,
      images: [photoUrl],
    },
  };
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const session = await getSessionServer();
  const isEditable = session?.uid === uid;
  const profile = await getProfileFromFirestore(uid);

  const photos = (profile?.photos || [])
    .map((p: any) => {
      if (typeof p === 'string') return { url: p, position: clampPhotoPositionY(undefined) };
      if (p?.url) return { url: p.url, position: clampPhotoPositionY(p.position) };
      return null;
    })
    .filter(Boolean) as { url: string; position: number }[];

  const DEFAULT_SECTION_ORDER = [
    'YouTube',
    'X',
    'Instagram',
    'TikTok',
    'Facebook',
    'BannerLinks',
    'AppProjects',
    'SNSButtons',
  ] as const;

  const rawOrder: string[] = profile?.settings?.sectionOrder?.length
    ? [...profile.settings.sectionOrder]
    : [...DEFAULT_SECTION_ORDER];

  /** 既存ユーザーに AppProjects が無い場合は SNSButtons の直前に挿入 */
  const sectionOrder: string[] = (() => {
    if (rawOrder.includes('AppProjects')) return rawOrder;
    const snsIdx = rawOrder.indexOf('SNSButtons');
    if (snsIdx >= 0) {
      return [...rawOrder.slice(0, snsIdx), 'AppProjects', ...rawOrder.slice(snsIdx)];
    }
    return [...rawOrder, 'AppProjects'];
  })();

  const appProjectsInitial = coerceAppsFromFirestore(profile?.apps);

  return (
    <>
      <Header
        topGalleryPhotos={photos.slice(0, 5)}
        showPhotoEditor={isEditable}
        photoEditorUid={uid}
        photoEditorPhotos={photos}
      />

      <UserPageSectionsClient
        uid={uid}
        isEditable={isEditable}
        initialProfile={profile}
        initialSectionOrder={sectionOrder}
        initialApps={appProjectsInitial}
      />

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
