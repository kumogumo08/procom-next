// next-sitemap.config.cjs

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://procom-next.onrender.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/account', '/login', '/register'],
};
