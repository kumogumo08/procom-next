// next-sitemap.config.cjs

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json'); // ← 環境に応じて調整

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://procom-next.onrender.com',
  generateRobotsTxt: true,
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 7000,
  exclude: ['/account', '/login', '/register', '/deleted', '/withdraw'],

  async additionalPaths() {
    const snapshot = await db.collection('users').get();
    const uids = snapshot.docs.map(doc => doc.id);

    return uids.map(uid => ({
      loc: `/user/${uid}`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 0.7,
    }));
  },
};
