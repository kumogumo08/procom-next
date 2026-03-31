// lib/firebaseClient.ts
// 二重初期化は getApps().length で防止。auth は各所で getAuth(firebaseApp)。
//
// 【クライアントで参照する環境変数（未設定時は下記 fallback を使用）】
// 必須に相当:
//   NEXT_PUBLIC_FIREBASE_API_KEY
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_FIREBASE_APP_ID
// 任意（Storage / FCM / Analytics 用。未設定時は fallback）:
//   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
//   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
//   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
//
import { initializeApp, getApps } from 'firebase/app';

/** リポジトリ同梱の既定値（env 未設定時のみ使用）— 本番では .env に NEXT_PUBLIC_* を置くことを推奨 */
const embeddedFallback = {
  apiKey: 'AIzaSyCMbC5f6vAFufLN-_F72iXvVhEugalzDfo',
  authDomain: 'procom-fea80.firebaseapp.com',
  projectId: 'procom-fea80',
  storageBucket: 'procom-fea80.firebasestorage.app',
  messagingSenderId: '615102362600',
  appId: '1:615102362600:web:f3bd9a2b0dd687053c2a5d',
  measurementId: 'G-8J2XCMF9D1',
} as const;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? embeddedFallback.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? embeddedFallback.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? embeddedFallback.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? embeddedFallback.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? embeddedFallback.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? embeddedFallback.appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? embeddedFallback.measurementId,
};

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const usingEnv = {
    apiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    appId: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
  console.log('[firebaseClient] projectId:', firebaseConfig.projectId);
  console.log('[firebaseClient] authDomain:', firebaseConfig.authDomain);
  console.log('[firebaseClient] app.name:', firebaseApp.name);
  console.log('[firebaseClient] env 使用状況 (true=env優先):', usingEnv);
}
