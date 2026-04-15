// app/api/all-uids/route.ts — UID 一覧（管理者セッション or ビルド用共有秘密のみ）
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import { verifySessionFromRequest } from '@/lib/session';
import { isAdmin } from '@/lib/isAdmin';

initializeFirebaseAdmin();
const db = getFirestore();

/**
 * - 本番では無認証のまま公開しない。
 * - 自動取得: Authorization: Bearer <ALL_UIDS_EXPORT_SECRET>（next-sitemap 等）
 * - 手動: ログイン管理者セッション
 * 呼び出し元が sitemap のみなら、秘密未設定時は 401 になり additionalPaths が空になる点に注意。
 */
export async function GET(req: NextRequest) {
  const exportSecret = process.env.ALL_UIDS_EXPORT_SECRET;
  const authHeader = req.headers.get('authorization');
  const bearer =
    authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  let allowed = false;
  if (exportSecret && bearer === exportSecret) {
    allowed = true;
  } else {
    const session = await verifySessionFromRequest(req);
    if (session?.uid && isAdmin(session.uid)) {
      allowed = true;
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const snapshot = await db.collection('users').get();
  const uids = snapshot.docs.map((doc) => doc.id);
  return NextResponse.json({ uids });
}
