// app/api/banner-links/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { verifySessionFromRequest } from '@/lib/session';
import { initializeFirebaseAdmin } from '@/lib/firebase';

export const runtime = 'nodejs'; // ✅ Edge Runtime対策

initializeFirebaseAdmin();
const db = getFirestore();
const bucket = getStorage().bucket();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return NextResponse.json({ error: 'uidが指定されていません' }, { status: 400 });
  }

  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
  }

  const data = doc.data();
  const banners = data?.profile?.bannerLinks ?? [];
  const settings = data?.profile?.settings ?? {}; // ✅ 追加！

  return NextResponse.json({ bannerLinks: banners, settings }); // ✅ settingsも返す
}

export async function POST(req: NextRequest) {
  const session = await verifySessionFromRequest(req);
  if (!session?.uid) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const body = await req.json();
  const { bannerLinks, showBanners } = body; // ✅ showBannersを取得

  if (!Array.isArray(bannerLinks)) {
    return NextResponse.json({ error: '不正なリクエスト' }, { status: 400 });
  }

  const profileRef = db.collection('users').doc(session.uid);
  const doc = await profileRef.get();
  const existing = doc.data() || {};
  const existingProfile = existing.profile || {};
  const existingSettings = existingProfile.settings || {};

  await profileRef.set(
    {
      profile: {
        ...existingProfile,
        bannerLinks,
        settings: {
          ...existingSettings,
          showBanners: showBanners ?? true, // ✅ 上書き or デフォルトtrue
        },
      },
    },
    { merge: true }
  );

  return NextResponse.json({ success: true });
}

