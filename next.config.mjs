/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    FIREBASE_KEY_PATH: process.env.FIREBASE_KEY_PATH,
  },
  experimental: {
    // 必要があればここに書く
  },
};

export default nextConfig;