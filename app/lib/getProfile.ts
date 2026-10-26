import { db } from './firebase-admin';

export async function getProfileFromFirestore(uid: string) {
  const doc = await db.collection('users').doc(uid).get();
  if (doc.get('deletionPending') === true) {
    return { deletionPending: true as const };
  }
  const data = doc.data();
  return data?.profile || {};
}

export function isWithdrawingProfile(profile: unknown): boolean {
  return !!profile && typeof profile === 'object' && (profile as { deletionPending?: unknown }).deletionPending === true;
}