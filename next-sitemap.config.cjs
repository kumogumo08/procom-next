// next-sitemap.config.js

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://procom-next.onrender.com', // ← ★あなたの本番URL
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/account', '/login', '/register'], // 非公開ページがあれば指定
};
