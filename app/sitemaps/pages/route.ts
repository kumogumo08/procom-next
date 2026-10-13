import { getListingPageCount } from '@/lib/listing/firestoreListing';
import { fixedPageHref } from '@/lib/listing/links';
import { urlSetXml, xmlResponse } from '@/lib/listing/sitemapXml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let pageCount = 0;
  try {
    pageCount = await getListingPageCount();
  } catch (err) {
    console.error('sitemap pages failed:', err);
  }
  const paths = ['/users'];
  for (let page = 1; page <= pageCount; page += 1) paths.push(fixedPageHref(page));
  return xmlResponse(urlSetXml(paths));
}
