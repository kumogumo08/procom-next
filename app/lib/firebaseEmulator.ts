/**
 * ローカル結合テスト専用。PROCOM_EMULATOR=1 のときだけ使う。
 * 設定が一つでも足りなければ、本番の鍵やプロジェクトへ進まず停止する。
 */

const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost):\d{2,5}$/;
const PRODUCTION_PROJECT = 'procom-fea80';

export type IsolatedEmulator = {
  projectId: string;
  storageBucket: string;
  authHost: string;
  firestoreHost: string;
  storageHost: string;
};

function requiredHost(value: string | undefined, label: string): string {
  if (!value || !LOOPBACK_HOST.test(value)) {
    throw new Error(`${label}のEmulator設定がありません。本番へは接続せず停止しました`);
  }
  if (value.endsWith(':8181')) {
    throw new Error('ポート8181は既存の一覧テスト用です。初期設定テストでは停止しました');
  }
  return value;
}

function readProject(projectId: string | undefined, cloudProject: string | undefined): string {
  if (!projectId || !projectId.startsWith('demo-') || projectId === PRODUCTION_PROJECT) {
    throw new Error('テスト用project idがdemo-で始まっていません。本番へは接続せず停止しました');
  }
  if (cloudProject && cloudProject !== projectId) {
    throw new Error('project idの指定が一致しません。本番へは接続せず停止しました');
  }
  return projectId;
}

function readBucket(bucket: string | undefined, projectId: string): string {
  if (!bucket || !bucket.startsWith(`${projectId}.`) || bucket.includes(PRODUCTION_PROJECT)) {
    throw new Error('Storageバケットがローカルテスト用ではありません。本番へは接続せず停止しました');
  }
  return bucket;
}

/** サーバーの Admin SDK。鍵ファイルは読まない。 */
export function assertServerEmulator(): IsolatedEmulator {
  if (process.env.PROCOM_EMULATOR !== '1') {
    throw new Error('Emulatorモードではありません。本番へは接続せず停止しました');
  }
  const projectId = readProject(
    process.env.FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  );
  return {
    projectId,
    storageBucket: readBucket(process.env.FIREBASE_STORAGE_BUCKET, projectId),
    authHost: requiredHost(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Auth'),
    firestoreHost: requiredHost(process.env.FIRESTORE_EMULATOR_HOST, 'Firestore'),
    storageHost: requiredHost(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 'Storage'),
  };
}

/** ブラウザ用 Client SDK。埋め込みの本番設定へは戻らない。 */
export function assertClientEmulator(): IsolatedEmulator {
  if (process.env.NEXT_PUBLIC_PROCOM_EMULATOR !== '1') {
    throw new Error('クライアントのEmulatorモードではありません。本番へは接続せず停止しました');
  }
  const projectId = readProject(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, undefined);
  return {
    projectId,
    storageBucket: readBucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, projectId),
    authHost: requiredHost(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST, 'Auth'),
    firestoreHost: requiredHost(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST, 'Firestore'),
    storageHost: requiredHost(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST, 'Storage'),
  };
}

export function splitLoopbackHost(value: string): { host: string; port: number } {
  const separator = value.lastIndexOf(':');
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  if (!host || !Number.isInteger(port)) {
    throw new Error('Emulatorのポートが不正です。本番へは接続せず停止しました');
  }
  return { host, port };
}
