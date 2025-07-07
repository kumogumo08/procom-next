// app/user/[uid]/page.tsx
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
import type { Metadata } from 'next';

// ✅ 修正ポイント：generateMetadataの定義方法
export const generateMetadata = async (
  { params }: { params: { uid: string } }
): Promise<Metadata> => {
  const profile = await getProfileFromFirestore(params.uid);

  const name = profile?.name ?? 'ユーザー';
  const title = `${name}さんのプロフィール | Procom`;
  const description =
    profile?.bio || 'SNSや活動履歴をまとめたページです。Procomであなたの魅力をもっと伝えよう。';

  const image =
    profile?.photos?.[0]?.url?.startsWith('https://firebasestorage') &&
    profile.photos[0].url.includes('token=')
      ? 'https://procom-next.onrender.com/og-image.jpg'
      : profile?.photos?.[0]?.url || 'https://procom-next.onrender.com/og-image.jpg';

  return {
    title,
    description,
    keywords: [name, 'Procom', 'プロフィール', 'SNSまとめ', 'フリーランス', '自己紹介'],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `https://procom-next.onrender.com/user/${params.uid}`,
    },
    openGraph: {
      title,
      description,
      url: `https://procom-next.onrender.com/user/${params.uid}`,
      siteName: 'Procom',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${name}のプロフィール画像`,
        },
      ],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    themeColor: '#4f7cf7',
  };
};

// ✅ ページ本体
export default async function UserPage({
  params,
}: {
  params: { uid: string };
}) {
  const uid = params.uid;
  const session = await getSessionServer();
  const isEditable = session?.uid === uid;
  const profile = await getProfileFromFirestore(uid);

  const photos = (profile?.photos || []).map((p: any) =>
    typeof p === 'string' ? { url: p, position: '50' } : { url: p.url, position: p.position ?? '50' }
  );

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
        <UserProfileSection uid={uid} isEditable={isEditable} />
        <UserPageClient uid={uid} profile={profile} isEditable={isEditable} />
        <YouTubeEmbedBlock uid={uid} isEditable={isEditable} />
        <div className="sns-container">
          <div className="sns-box">
            <XEmbed uid={uid} isEditable={isEditable} />
          </div>
          <div className="sns-box">
            <InstagramEmbed uid={uid} isEditable={isEditable} />
          </div>
        </div>
        <TikTokEmbed uid={uid} isEditable={isEditable} />
        <FacebookEmbedBlock uid={uid} isEditable={isEditable} />
        <QRCodeBlock />
      </main>
      <Footer />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
        strategy="afterInteractive"
      />
      <Script src="https://www.tiktok.com/embed.js" strategy="afterInteractive" />
      <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" />
      <Script src="https://www.instagram.com/embed.js" strategy="afterInteractive" />
    </>
  );
}
