import { getListingPageCount } from '@/lib/listing/firestoreListing';
import { sitemapIndexPaths, sitemapIndexXml, xmlResponse } from '@/lib/listing/sitemapXml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let pageCount = 0;
  try {
    pageCount = await getListingPageCount();
  } catch (err) {
    console.error('sitemap index page count failed:', err);
  }
  return xmlResponse(sitemapIndexXml(sitemapIndexPaths(pageCount)));
}
