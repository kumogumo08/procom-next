import { getProfileFromFirestore } from '@/lib/getProfile';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uid: string }>
}): Promise<Metadata> {
  const { uid } = await params;
  const profile = await getProfileFromFirestore(uid);
  const name = profile?.name ?? 'ユーザー';
  const title = `${name}さんのプロフィール | Procom`;
  const description =
    profile?.bio ||
    'SNSや活動履歴をまとめたページです。Procom（プロコム）であなたの魅力をもっと伝えよう。';
  const image =
    profile?.photos?.[0]?.url?.startsWith('https://firebasestorage') &&
    profile.photos[0].url.includes('token=')
      ? 'https://procom-next.onrender.com/og-image.jpg'
      : profile?.photos?.[0]?.url ||
        'https://procom-next.onrender.com/og-image.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://procom-next.onrender.com/user/${uid}`,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
