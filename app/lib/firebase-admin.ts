// lib/firebase-admin.ts
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// 初期化チェック
if (!admin.apps.length) {
  // 🔑 環境変数から秘密鍵ファイルパスを取得
  const keyPath = process.env.FIREBASE_KEY_PATH;

  if (!keyPath) {
    throw new Error('環境変数 FIREBASE_KEY_PATH が未設定です');
  }

  // 🔐 秘密鍵を読み込み・改行コード修正
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.resolve(keyPath), 'utf8')
  );

  if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();
