import { getProfileFromFirestore } from '@/lib/getProfile';
import type { Metadata } from 'next';

type Params = { uid: string };

export async function generateMetadata(
  { params }: { params: Params }
): Promise<Metadata> {
  const { uid } = params;                       // ← Promise は不要
  const profile = await getProfileFromFirestore(uid);

  const name = (profile?.name || 'ユーザー').toString();
  const isPublic = profile?.isPublic ?? true;   // ← 実データに合わせて
  const canonical = `https://procom.jp/user/${uid}`;

  // OG画像：トークン付きや相対など“怪しい”場合はフォールバック
  const rawImg = profile?.photos?.[0]?.url as string | undefined;
  const isUnsafe =
    !rawImg ||
    !/^https?:\/\//.test(rawImg) ||
    (rawImg.startsWith('https://firebasestorage') && rawImg.includes('token='));
  const image = isUnsafe ? 'https://procom.jp/og-image.jpg' : rawImg;

  // KWを自然に含めたタイトル/説明
  const title = `${name}｜プロフィール・SNSリンク集 - Procom（プロコム）`;
  const description =
    profile?.bio
      || `${name}さんのプロフィールとSNSリンク集のまとめページ。Procom（プロコム）で作品・SNS・活動情報を1ページに集約。`;

  return {
    title,
    description,
    metadataBase: new URL('https://procom.jp'),
    alternates: { canonical },
    robots: {
      index: isPublic,
      follow: isPublic,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'profile',                       // ← profile型
      images: [{ url: image!, width: 1200, height: 630, alt: `${name}のプロフィール` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image!],
    },
    // 任意：ロングテール強化
    keywords: ['プロフィール作成','SNSリンク集','リンクインバイオ','名刺サイト','Procom','プロコム', name],
  };
}
