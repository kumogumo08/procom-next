import type { MetadataRoute } from 'next';

export const runtime = 'nodejs';
export const revalidate = 3600;

const SITE = 'https://procom.jp';

/** 静的入口だけ。プロフィールURLは /sitemaps の分割サイトマップへ。users 全件読みはしない。 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/top`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/users`, lastModified, changeFrequency: 'daily', priority: 0.8 },
  ];
}
