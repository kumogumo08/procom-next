/**
 * Emulator設定が欠けているプロセスで、本番の鍵を読まずに停止することを確認する。
 * このファイル単体では登録や保存をしない。
 */
import { readFileSync } from 'node:fs';

const mode = process.argv[2];
const sentinel = process.argv[3];
const before = sentinel ? readFileSync(sentinel, 'utf8') : '';

process.env.PROCOM_EMULATOR = '1';
process.env.FIREBASE_KEY_PATH = sentinel;
process.env.FIREBASE_KEY_JSON = '';
process.env.FIREBASE_CONFIG = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';

if (mode === 'missing') {
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  process.env.FIREBASE_PROJECT_ID = 'demo-procom-local';
  process.env.GCLOUD_PROJECT = 'demo-procom-local';
  process.env.GOOGLE_CLOUD_PROJECT = 'demo-procom-local';
  process.env.FIREBASE_STORAGE_BUCKET = 'demo-procom-local.firebasestorage.app';
} else if (mode === 'project') {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8282';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  process.env.FIREBASE_PROJECT_ID = 'procom-fea80';
  process.env.GCLOUD_PROJECT = 'procom-fea80';
  process.env.GOOGLE_CLOUD_PROJECT = 'procom-fea80';
  process.env.FIREBASE_STORAGE_BUCKET = 'demo-procom-local.firebasestorage.app';
} else if (mode === 'bucket') {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8282';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  process.env.FIREBASE_PROJECT_ID = 'demo-procom-local';
  process.env.GCLOUD_PROJECT = 'demo-procom-local';
  process.env.GOOGLE_CLOUD_PROJECT = 'demo-procom-local';
  process.env.FIREBASE_STORAGE_BUCKET = 'procom-fea80.firebasestorage.app';
} else {
  console.log('OTHER');
  process.exit(1);
}

try {
  await import('../../app/lib/firebase');
  console.log('STARTED');
  process.exit(2);
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  const after = sentinel ? readFileSync(sentinel, 'utf8') : '';
  const stopped = message.includes('停止しました');
  if (stopped && before === after) console.log('REFUSED');
  else console.log('OTHER');
  process.exit(stopped ? 1 : 3);
}
