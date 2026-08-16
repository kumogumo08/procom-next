import type { MetadataRoute } from 'next';

import { getPublicUserUidsForSitemap } from '@/lib/publicUsers';

export const runtime = 'nodejs';
export const revalidate = 3600;

const SITE = 'https://procom.jp';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/top`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/users`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ];

  const uids = await getPublicUserUidsForSitemap();
  const userEntries: MetadataRoute.Sitemap = uids.map((uid) => ({
    url: `${SITE}/user/${uid}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...userEntries];
}
