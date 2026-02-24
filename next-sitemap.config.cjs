// next-sitemap.config.cjs

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://procom.jp',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/account', '/login', '/register', '/deleted', '/withdraw'],

  async additionalPaths() {
    const baseUrl = process.env.SITEMAP_BASE_URL || 'https://procom.jp';

    // タイムアウト（10秒）
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${baseUrl}/api/all-uids`, {
        signal: controller.signal,
        headers: { 'accept': 'application/json' },
      });

      if (!res.ok) {
        console.error('❌ UID取得失敗:', res.status, res.statusText);
        return [];
      }

      const data = await res.json();
      const uids = Array.isArray(data?.uids) ? data.uids : [];

      return uids.map((uid) => ({
        loc: `/user/${uid}`,
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('❌ UID取得エラー:', err);
      return [];
    } finally {
      clearTimeout(t);
    }
  },
};