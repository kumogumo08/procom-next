// lib/firebaseClient.ts
// 二重初期化は getApps().length で防止。auth は各所で getAuth(firebaseApp)。
//
// 本番: NEXT_PUBLIC_* のみ（リポジトリに埋め込みフォールバックは使わない）
// 開発: env 未設定時のみ embeddedFallback を使用可能
//
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';

const embeddedFallback = {
  apiKey: 'AIzaSyCMbC5f6vAFufLN-_F72iXvVhEugalzDfo',
  authDomain: 'procom-fea80.firebaseapp.com',
  projectId: 'procom-fea80',
  storageBucket: 'procom-fea80.firebasestorage.app',
  messagingSenderId: '615102362600',
  appId: '1:615102362600:web:f3bd9a2b0dd687053c2a5d',
  measurementId: 'G-8J2XCMF9D1',
} as const;

const isDev = process.env.NODE_ENV === 'development';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `[firebaseClient] ${name} is required in production. Set NEXT_PUBLIC_* in the deployment environment.`
    );
  }
  return v;
}

function buildFirebaseConfig(): FirebaseOptions {
  if (isDev) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? embeddedFallback.apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? embeddedFallback.authDomain,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? embeddedFallback.projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? embeddedFallback.storageBucket,
      messagingSenderId:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? embeddedFallback.messagingSenderId,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? embeddedFallback.appId,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? embeddedFallback.measurementId,
    };
  }

  const base: FirebaseOptions = {
    apiKey: requireEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: requireEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
  };
  const m = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  return m ? { ...base, measurementId: m } : base;
}

const firebaseConfig = buildFirebaseConfig();

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

if (isDev && typeof window !== 'undefined') {
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
