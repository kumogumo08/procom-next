import { cache } from 'react';
import { readUserAccountKind } from '@/lib/accountKind';
import { readUserSuspended } from '@/lib/accountSuspension';
import { canShowPublicFanActivity } from '@/lib/fanActivityVisibility';
import { db } from './firebase-admin';

const readUserDoc = cache(async function readUserDoc(uid: string) {
  return db.collection('users').doc(uid).get();
});

/**
 * 文書が無いときだけ null。
 * 取得の失敗は投げたままにする。文書があり profile が空なら従来どおり {}。
 * generateMetadata とページ本文で同じ読み取りを共有する。
 */
export const getProfileFromFirestore = cache(async function getProfileFromFirestore(uid: string) {
  const doc = await readUserDoc(uid);
  if (!doc.exists) return null;
  if (doc.get('deletionPending') === true) {
    return { deletionPending: true as const };
  }
  if (readUserSuspended(doc.data())) {
    return { accountSuspended: true as const };
  }
  const data = doc.data();
  return data?.profile || {};
});

export const getAccountKindFromFirestore = cache(async function getAccountKindFromFirestore(uid: string) {
  const doc = await readUserDoc(uid);
  return readUserAccountKind(doc.data());
});

/** 一般公開してよいか。プロフィール取得と同じ文書読み取りを共有する。 */
export const isPublicFanActivityPage = cache(async function isPublicFanActivityPage(uid: string) {
  const doc = await readUserDoc(uid);
  if (!doc.exists) return false;
  return canShowPublicFanActivity(doc.data());
});

export function isWithdrawingProfile(profile: unknown): boolean {
  return !!profile && typeof profile === 'object' && (profile as { deletionPending?: unknown }).deletionPending === true;
}

export function isSuspendedProfile(profile: unknown): boolean {
  return !!profile && typeof profile === 'object' && (profile as { accountSuspended?: unknown }).accountSuspended === true;
}