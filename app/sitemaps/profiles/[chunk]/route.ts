import { profileSeqRange } from '@/lib/listing/firestoreListing';
import { SITEMAP_CHUNK, urlSetXml, xmlResponse } from '@/lib/listing/sitemapXml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ chunk: string }> }) {
  const { chunk: raw } = await ctx.params;
  if (!/^\d+$/.test(raw)) return new Response('Not Found', { status: 404 });
  const chunk = Number(raw);
  if (!Number.isSafeInteger(chunk) || chunk < 0 || chunk > 9999) {
    return new Response('Not Found', { status: 404 });
  }
  const start = chunk * SITEMAP_CHUNK + 1;
  const end = start + SITEMAP_CHUNK - 1;
  try {
    const uids = await profileSeqRange(start, end);
    return xmlResponse(urlSetXml(uids.map((uid) => `/user/${uid}`)));
  } catch (err) {
    console.error('sitemap profiles failed:', err);
    return new Response('sitemap error', { status: 500 });
  }
}
