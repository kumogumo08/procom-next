import { db } from './firebase-admin';

export async function getProfileFromFirestore(uid: string) {
  const doc = await db.collection('users').doc(uid).get();
  const data = doc.data();
  return data?.profile || {};
}