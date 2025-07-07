// app/user/[uid]/generate-metadata.ts
import { getProfileFromFirestore } from '@/lib/getProfile';
import type { Metadata, ResolvingMetadata } from 'next';

export async function generateMetadata(
  params: { uid: string },
  _parent?: ResolvingMetadata
): Promise<Metadata> {
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
      : profile?.photos?.[0]?.url || 'https://procom-next.onrender.com/og-image.jpg';

  return {
    title,
    description,
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
  };
}
