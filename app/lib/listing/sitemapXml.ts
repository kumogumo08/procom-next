const SITE = 'https://procom.jp';

export const SITEMAP_CHUNK = 5000;

export function sitemapIndexPaths(pageCount: number): string[] {
  const paths = ['/sitemaps/core', '/sitemaps/pages'];
  const chunks = pageCount > 0 ? Math.ceil((pageCount * 20) / SITEMAP_CHUNK) : 0;
  for (let chunk = 0; chunk < chunks; chunk += 1) {
    paths.push(`/sitemaps/profiles/${chunk}`);
  }
  return paths;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sitemapIndexXml(paths: string[]): string {
  const body = paths
    .map((path) => `<sitemap><loc>${escapeXml(`${SITE}${path}`)}</loc></sitemap>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export function urlSetXml(paths: string[]): string {
  const lastmod = new Date().toISOString();
  const body = paths
    .map(
      (path) =>
        `<url><loc>${escapeXml(`${SITE}${path}`)}</loc><lastmod>${lastmod}</lastmod></url>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
