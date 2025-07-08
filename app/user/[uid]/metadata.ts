import { getProfileFromFirestore } from '@/lib/getProfile';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { uid: string };
}): Promise<Metadata> {
  const profile = await getProfileFromFirestore(params.uid);
  const name = profile?.name ?? 'ユーザー';
  const title = `${name}さんのプロフィール | Procom`;
  const description =
    profile?.bio ||
    'SNSや活動履歴をまとめたページです。Procomであなたの魅力をもっと伝えよう。';
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
      url: `https://procom-next.onrender.com/user/${params.uid}`,
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
