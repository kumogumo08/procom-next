// =====================================================
// ⚠ SECURITY WARNING ⚠
// このファイルは機密情報を扱う。
// 外部チャット、SNS、スクショへの貼り付け禁止。
// 環境変数値を絶対に公開しない。
// =====================================================

import 'server-only';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// ローカル開発だけ .env を読む（Render本番はEnvironment Variablesを使う）
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { assertServerEmulator } from '@/lib/firebaseEmulator';
import { emulatorServiceAccount, markEmulatorCredential } from '@/lib/firebaseEmulatorCredential';

if (!admin.apps.length) {
  if (process.env.PROCOM_EMULATOR === '1') {
    const isolated = assertServerEmulator();
    admin.initializeApp({
      projectId: isolated.projectId,
      storageBucket: isolated.storageBucket,
      credential: admin.credential.cert(emulatorServiceAccount(isolated.projectId)),
    });
    markEmulatorCredential();
  } else {
    const keyPath = process.env.FIREBASE_KEY_PATH;
    if (!keyPath) throw new Error('環境変数 FIREBASE_KEY_PATH が未設定です');

    const resolvedPath = path.resolve(keyPath);
    if (!fs.existsSync(resolvedPath)) throw new Error(`秘密鍵ファイルが見つかりません: ${resolvedPath}`);

    const serviceAccount: any = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();

// ★ これを追加
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
