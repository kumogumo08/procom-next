/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: false,
  output: 'standalone',
  reactStrictMode: true,
  env: {
    FIREBASE_KEY_PATH: process.env.FIREBASE_KEY_PATH,
  },
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  experimental: {
    // 必要があればここに書く
  },
  /**
   * Windows 等で dev 時に .next 内チャンク参照が不整合になる事例への対策:
   * 開発中は webpack の永続ファイルキャッシュを使わずメモリキャッシュに寄せる。
   * （初回コンパイルはやや重くなるが、壊れたキャッシュを抱え続けにくい）
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  },
};

export default nextConfig;
