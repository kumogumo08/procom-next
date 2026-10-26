// app/lib/firebase.ts
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { assertServerEmulator } from '@/lib/firebaseEmulator';
import { emulatorServiceAccount, markEmulatorCredential } from '@/lib/firebaseEmulatorCredential';

let initialized = false;

export function initializeFirebaseAdmin(): void {
  if (admin.apps.length > 0) return;

  if (process.env.PROCOM_EMULATOR === '1') {
    const isolated = assertServerEmulator();
    admin.initializeApp({
      projectId: isolated.projectId,
      storageBucket: isolated.storageBucket,
      credential: admin.credential.cert(emulatorServiceAccount(isolated.projectId)),
    });
    markEmulatorCredential();
    initialized = true;
    return;
  }

  const keyPath = process.env.FIREBASE_KEY_PATH;
  if (!keyPath) throw new Error('FIREBASE_KEY_PATH が .env に設定されていません');

  // 🔐 ファイルから安全に読み込む
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.resolve(keyPath), 'utf8')
  );

  // 🔧 改行補正（必要な場合）
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'procom-fea80.firebasestorage.app', 
  });

  initialized = true;
}

initializeFirebaseAdmin();

const db: admin.firestore.Firestore = admin.firestore();
const bucket = admin.storage().bucket();

export { admin, db, bucket };
