import { urlSetXml, xmlResponse } from '@/lib/listing/sitemapXml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return xmlResponse(urlSetXml(['/', '/top', '/users', '/sitemaps']));
}
