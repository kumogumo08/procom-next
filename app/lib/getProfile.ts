import { cache } from 'react';
import { db } from './firebase-admin';

/**
 * 文書が無いときだけ null。
 * 取得の失敗は投げたままにする。文書があり profile が空なら従来どおり {}。
 * generateMetadata とページ本文で同じ読み取りを共有する。
 */
export const getProfileFromFirestore = cache(async function getProfileFromFirestore(uid: string) {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  if (doc.get('deletionPending') === true) {
    return { deletionPending: true as const };
  }
  const data = doc.data();
  return data?.profile || {};
});

export function isWithdrawingProfile(profile: unknown): boolean {
  return !!profile && typeof profile === 'object' && (profile as { deletionPending?: unknown }).deletionPending === true;
}