export const runtime = 'nodejs';

import React from 'react';
import { getProfileFromFirestore, isWithdrawingProfile } from '@/lib/getProfile';
import { getLoggedInUid } from '@/lib/session';
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
import { redirect } from 'next/navigation';
import UserPageSectionsClient from '@/components/UserPageSectionsClient';
import { clampPhotoPositionY } from '@/lib/photoPosition';
import { resolveSectionOrder } from '@/lib/blockLayout';
import { isOnboardingBlocked, readOnboardingGate } from '@/lib/onboarding';
import { buildProfileDocumentTitle, isProfilePublic } from '@/lib/userSeo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uid: string }>;
}): Promise<Metadata> {
  const { uid } = await params;
  const profile = await getProfileFromFirestore(uid);
  if (isWithdrawingProfile(profile) || isOnboardingBlocked(profile)) {
    return {
      title: 'Procom',
      description: 'このプロフィールは公開されていません',
      alternates: { canonical: `/user/${uid}` },
      robots: { index: false, follow: false },
      openGraph: {
        title: 'Procom',
        description: 'このプロフィールは公開されていません',
        url: `https://procom.jp/user/${uid}`,
        siteName: 'Procom',
        images: [{ url: 'https://procom.jp/og-image.jpg', width: 1200, height: 630, alt: 'Procom' }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Procom',
        description: 'このプロフィールは公開されていません',
        images: ['https://procom.jp/og-image.jpg'],
      },
    };
  }
  const name = profile?.name || 'Procomユーザー';
  const pageTitle = buildProfileDocumentTitle(profile?.name, profile?.title);
  const bio = profile?.bio || 'SNSプロフィールとリンク集をまとめたページ';
  const photoUrl =
    profile?.photos?.[0]?.url || 'https://procom.jp/og-image.jpg';
  const isPublic = isProfilePublic(profile);

  return {
    title: pageTitle,
    description: bio,
    alternates: {
      canonical: `/user/${uid}`,
    },
    robots: {
      index: isPublic,
      follow: isPublic,
    },
    openGraph: {
      title: pageTitle,
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
      title: pageTitle,
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
  const loggedInUid = await getLoggedInUid();
  const isEditable = loggedInUid === uid;
  const profile = await getProfileFromFirestore(uid);

  if (isWithdrawingProfile(profile) || isOnboardingBlocked(profile)) {
    if (!isWithdrawingProfile(profile) && readOnboardingGate(profile) === 'required' && isEditable) {
      redirect('/profile/setup');
    }
    return (
      <>
        <Header
          topGalleryPhotos={[]}
          showPhotoEditor={false}
          photoEditorUid={uid}
          photoEditorPhotos={[]}
        />
        <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', color: '#0f172a' }}>このプロフィールは公開されていません</h1>
        </main>
        <Footer />
      </>
    );
  }

  const photos = (profile?.photos || [])
    .map((p: any) => {
      if (typeof p === 'string') return { url: p, position: clampPhotoPositionY(undefined) };
      if (p?.url) return { url: p.url, position: clampPhotoPositionY(p.position) };
      return null;
    })
    .filter(Boolean) as { url: string; position: number }[];

  const sectionOrder = resolveSectionOrder(
    profile?.settings?.sectionOrder,
    profile?.settings?.blockLayoutVersion
  );

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
      <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" />
    </>
  );
}
