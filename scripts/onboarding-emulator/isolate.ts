/**
 * 初期設定の結合テスト専用。値はローカルの固定値で、本番の環境変数は使わない。
 * 一覧テストの Firestore Emulator（127.0.0.1:8181）とはポートを分けている。
 */
export const EMULATOR = {
  projectId: 'demo-procom-local',
  authHost: '127.0.0.1:9099',
  firestoreHost: '127.0.0.1:8282',
  storageHost: '127.0.0.1:9199',
  hubHost: '127.0.0.1:4401',
  storageBucket: 'demo-procom-local.firebasestorage.app',
  nextPort: 3100,
} as const;

export const LOCAL_SESSION_PASSWORD = 'local-emulator-only-session-password-32';
export const LOCAL_DELETION_SEAL_KEY_ID = 'local-k2';
export const LOCAL_DELETION_SEAL_SECRET = 'local-emulator-deletion-seal-current-32';
export const LOCAL_DELETION_SEAL_KEY_ID_PREVIOUS = 'local-k1';
export const LOCAL_DELETION_SEAL_SECRET_PREVIOUS = 'local-emulator-deletion-seal-previous-32';
export const LOCAL_DELETION_RESUME_SECRET = 'local-emulator-account-deletion-resume';

export function isolatedAssignments(): Record<string, string> {
  return {
    PROCOM_EMULATOR: '1',
    NEXT_PUBLIC_PROCOM_EMULATOR: '1',
    FIREBASE_PROJECT_ID: EMULATOR.projectId,
    GCLOUD_PROJECT: EMULATOR.projectId,
    GOOGLE_CLOUD_PROJECT: EMULATOR.projectId,
    FIREBASE_AUTH_EMULATOR_HOST: EMULATOR.authHost,
    FIRESTORE_EMULATOR_HOST: EMULATOR.firestoreHost,
    FIREBASE_STORAGE_EMULATOR_HOST: EMULATOR.storageHost,
    FIREBASE_STORAGE_BUCKET: EMULATOR.storageBucket,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR.projectId,
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: EMULATOR.authHost,
    NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: EMULATOR.firestoreHost,
    NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST: EMULATOR.storageHost,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: EMULATOR.storageBucket,
    NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-local-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
    NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-local',
    SESSION_PASSWORD: LOCAL_SESSION_PASSWORD,
    ACCOUNT_DELETION_SEAL_KEY_ID: LOCAL_DELETION_SEAL_KEY_ID,
    ACCOUNT_DELETION_SEAL_SECRET: LOCAL_DELETION_SEAL_SECRET,
    ACCOUNT_DELETION_SEAL_KEY_ID_PREVIOUS: LOCAL_DELETION_SEAL_KEY_ID_PREVIOUS,
    ACCOUNT_DELETION_SEAL_SECRET_PREVIOUS: LOCAL_DELETION_SEAL_SECRET_PREVIOUS,
    ACCOUNT_DELETION_RESUME_SECRET: LOCAL_DELETION_RESUME_SECRET,
    LISTING_SYNC_SECRET: 'local-emulator-listing-sync',
    LISTING_DIRECTORY_READY: '0',
    NEXT_PUBLIC_BASE_URL: `http://127.0.0.1:${EMULATOR.nextPort}`,
    FIREBASE_KEY_PATH: '',
    FIREBASE_KEY_JSON: '',
    FIREBASE_CONFIG: '',
    GOOGLE_APPLICATION_CREDENTIALS: '',
    NODE_ENV: 'development',
  };
}

export function applyIsolatedEnv(target: NodeJS.ProcessEnv = process.env): void {
  for (const [key, value] of Object.entries(isolatedAssignments())) {
    target[key] = value;
  }
}
