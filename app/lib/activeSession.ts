import { admin } from '@/lib/firebase';

/** Auth にユーザーがいるときだけ UID を返す。Cookie は消さない。 */
export async function confirmActiveUid(uid: string | null | undefined): Promise<string | null> {
  if (!uid) return null;
  try {
    await admin.auth().getUser(uid);
    return uid;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/user-not-found') return null;
    console.error('Authユーザー確認に失敗:', code ?? 'unknown');
    return null;
  }
}
