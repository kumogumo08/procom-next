// lib/firebaseClient.ts
// 二重初期化は getApps().length で防止。auth は各所で getAuth(firebaseApp)。
//
// 本番: NEXT_PUBLIC_* のみ（リポジトリに埋め込みフォールバックは使わない）
// 開発: env 未設定時のみ embeddedFallback を使用可能
//
// lib/firebaseClient.ts
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

// 直接参照で固定
const envApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const envAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const envStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const envMessagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const envAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const envMeasurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

function required(value: string | undefined, name: string): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[firebaseClient] ${name} is required in production. Set NEXT_PUBLIC_* in the deployment environment.`
    );
  }
  return value;
}

function buildFirebaseConfig(): FirebaseOptions {
  if (isDev) {
    return {
      apiKey: envApiKey ?? embeddedFallback.apiKey,
      authDomain: envAuthDomain ?? embeddedFallback.authDomain,
      projectId: envProjectId ?? embeddedFallback.projectId,
      storageBucket: envStorageBucket ?? embeddedFallback.storageBucket,
      messagingSenderId: envMessagingSenderId ?? embeddedFallback.messagingSenderId,
      appId: envAppId ?? embeddedFallback.appId,
      measurementId: envMeasurementId ?? embeddedFallback.measurementId,
    };
  }

  const base: FirebaseOptions = {
    apiKey: required(envApiKey, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: required(envAuthDomain, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: required(envProjectId, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: required(envStorageBucket, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: required(
      envMessagingSenderId,
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
    ),
    appId: required(envAppId, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
  };

  return envMeasurementId ? { ...base, measurementId: envMeasurementId } : base;
}

const firebaseConfig = buildFirebaseConfig();

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

if (typeof window !== 'undefined') {
  console.log('[firebaseClient] NODE_ENV:', process.env.NODE_ENV);
  console.log('[firebaseClient] env exists:', {
    apiKey: Boolean(envApiKey),
    authDomain: Boolean(envAuthDomain),
    projectId: Boolean(envProjectId),
    storageBucket: Boolean(envStorageBucket),
    messagingSenderId: Boolean(envMessagingSenderId),
    appId: Boolean(envAppId),
    measurementId: Boolean(envMeasurementId),
  });
}