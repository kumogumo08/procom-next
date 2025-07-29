// next-sitemap.config.cjs

/** @type {import('next-sitemap').IConfig} */
const fetch = require('node-fetch');

module.exports = {
  siteUrl: 'https://procom.jp.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/account', '/login', '/register', '/deleted', '/withdraw'],

  async additionalPaths(config) {
    try {
      const res = await fetch('https://procom.jp/api/all-uids');
      const { uids } = await res.json();

      return uids.map(uid => ({
        loc: `/user/${uid}`,
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('❌ UID取得エラー:', err);
      return [];
    }
  }
};
