// app/lib/firebase.ts
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

export function initializeFirebaseAdmin(): void {
  if (admin.apps.length > 0) return;

  const keyPath = process.env.FIREBASE_KEY_PATH;
  if (!keyPath) throw new Error('FIREBASE_KEY_PATH が .env に設定されていません');

  const serviceAccount = JSON.parse(
    fs.readFileSync(path.resolve(keyPath), 'utf8')
  );

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'procom-fea80.firebasestorage.app', // 🔧 ← typo修正
  });
}

const db: admin.firestore.Firestore = admin.firestore();
const bucket = admin.storage().bucket();

export { admin, db, bucket };
