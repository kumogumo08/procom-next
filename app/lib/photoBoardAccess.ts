import { isAdmin } from '@/lib/isAdmin';

/**
 * PHOTO BOARD を使える本人か。
 * 今は管理者だけ。PRO 会員へ開くときは、この関数に判定を足す。
 * uid はサーバーが確認したセッションのものに限る。クライアントのフラグは見ない。
 */
export function canUsePhotoBoard(uid: string | null | undefined): boolean {
  return isAdmin(uid ?? undefined);
}
