// next-sitemap.config.cjs

/** @type {import('next-sitemap').IConfig} */
const fetch = require('node-fetch'); // 追記：APIでUID一覧を取得するために必要

module.exports = {
  siteUrl: 'https://procom-next.onrender.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/account', '/login', '/register', '/deleted', '/withdraw'],

  // 🔽 追加: user/[uid] を含めるための設定
  async additionalPaths(config) {
    const res = await fetch('https://procom-next.onrender.com/api/all-uids');
    const { uids } = await res.json();

    return uids.map(uid => ({
      loc: `/user/${uid}`,
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date().toISOString(),
    }));
  },
};
