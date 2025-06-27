// app/api/init/firebase-admin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON!);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'procom-fea80.firebasestorage.app',
  });
}

export const db = getFirestore();
export const bucket = getStorage().bucket();
