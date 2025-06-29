// app/api/user/[uid]/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import type { SessionData } from '@/lib/session-types';
import { db } from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase';

initializeFirebaseAdmin();

const firestore = getFirestore();
const bucket = getStorage().bucket();

function cleanData(obj: Record<string, any>) {
  const cleaned: Record<string, any> = {};
  for (const key in obj) {
    const value = obj[key];
    if (
      value !== undefined &&
      value !== null &&
      !(typeof value === 'string' && value.trim() === '') &&
      !(Array.isArray(value) && value.length === 0)
    ) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// --- GET: プロフィール情報取得 ---
export async function GET(
  req: NextRequest,
  context: { params: { uid: string } }
): Promise<NextResponse> {
  try {
    const { uid } = context.params;

    if (!uid) {
      return NextResponse.json({ error: 'uidが指定されていません' }, { status: 400 });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'ユーザーが存在しません' }, { status: 404 });
    }

    const data = userDoc.data();
    const rawProfile = data?.profile || {};

    const photos = Array.isArray(rawProfile.photos)
      ? rawProfile.photos
          .map((p: any) =>
            typeof p === 'string'
              ? { url: p, position: '50' }
              : p?.url
              ? { url: p.url, position: p.position || '50' }
              : null
          )
          .filter(Boolean) as { url: string; position?: string }[]
      : [];

    const profile = {
      name: rawProfile.name ?? '',
      title: rawProfile.title ?? '',
      bio: rawProfile.bio ?? '',
      photos,
      youtubeChannelId: rawProfile.youtubeChannelId ?? '',
      instagramPostUrl: rawProfile.instagramPostUrl ?? '',
      xUsername: rawProfile.xUsername ?? '',
      tiktokUrls: rawProfile.tiktokUrls ?? [],
      calendarEvents: rawProfile.calendarEvents ?? [],
      youtubeMode: rawProfile.youtubeMode ?? 'latest',
      manualYouTubeUrls: rawProfile.manualYouTubeUrls ?? [],
      facebookUrl: rawProfile.facebookUrl ?? '',
    };

    return NextResponse.json({
      message: 'ユーザー取得成功',
      uid,
      profile,
    });
  } catch (err) {
    console.error('❌ ユーザー取得中エラー:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// --- POST: プロフィール保存 ---
export async function POST(req: NextRequest, props: { params: Promise<{ uid: string }> }) {
  const params = await props.params;
  try {
    const uid = params.uid;
    if (!uid) {
      return NextResponse.json({ error: 'uidが指定されていません' }, { status: 400 });
    }

    const session = await getIronSession<SessionData>(req, new NextResponse(), sessionOptions);
    if (!session?.uid || session.uid !== uid) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const incoming = await req.json();
    const profile = incoming.profile;

    if (!profile || typeof profile !== 'object') {
      return NextResponse.json({ error: 'プロフィール情報が正しくありません' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'ユーザーが存在しません' }, { status: 404 });
    }

    const existing = userDoc.data() || {};
    const existingProfile = existing.profile || {};

    // 📅 カレンダー
    if (
      profile.calendarEvents &&
      typeof profile.calendarEvents === 'object' &&
      !Array.isArray(profile.calendarEvents)
    ) {
      profile.calendarEvents = Object.entries(profile.calendarEvents)
        .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .map(([date, events]: any) => ({
          date,
          events: Array.isArray(events) ? events : [events],
        }));
    }

    if (Array.isArray(profile.calendarEvents)) {
      profile.calendarEvents = profile.calendarEvents
        .filter((e: any) => typeof e === 'object' && e.date && Array.isArray(e.events))
        .map((e: any) => ({ date: String(e.date), events: e.events.map(String) }));
    } else {
      delete profile.calendarEvents;
    }

    // 🖼️ 写真処理
    if (!Array.isArray(profile.photos) || profile.photos.length === 0) {
      profile.photos = existingProfile.photos ?? [];
    } else {
      const base64Photos = profile.photos.filter(
        (p: any) => typeof p === 'string' && p.startsWith('data:image/')
      );
      const nonBase64Photos = profile.photos.filter((p: any) => typeof p === 'object' && p.url);

      if (base64Photos.length > 0) {
        const uploadedPhotoUrls: string[] = [];

        if (existingProfile.photos && Array.isArray(existingProfile.photos)) {
          const deletedSet = new Set();
          for (const old of existingProfile.photos) {
            try {
              const match = decodeURIComponent(old.url).match(/\/o\/(.+)\?alt=media/);
              if (match && match[1] && !deletedSet.has(match[1])) {
                await bucket.file(match[1]).delete();
                deletedSet.add(match[1]);
              }
            } catch (e) {
              console.warn('⚠️ 古い画像削除失敗:', e);
            }
          }
        }

        for (const base64 of base64Photos) {
          const match = base64.match(/^data:(image\/.+);base64,(.+)$/);
          if (!match) continue;
          const [_, type, base64Data] = match;
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = type.split('/')[1];
          const fileName = `photos/${uid}/${uuidv4()}.${ext}`;
          const file = bucket.file(fileName);
          const token = uuidv4();

          await file.save(buffer, {
            metadata: {
              contentType: type,
              metadata: { firebaseStorageDownloadTokens: token },
            },
          });

          const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
            fileName
          )}?alt=media&token=${token}`;
          uploadedPhotoUrls.push(url);
        }

        profile.photos = uploadedPhotoUrls.map((url, i) => ({
          url,
          position: base64Photos[i]?.position ?? '50',
        }));
      } else {
        profile.photos = nonBase64Photos.map((photo: any) => ({
          url: photo.url,
          position: photo.position ?? '50',
        }));
      }
    }

    // 🔄 プロフィール保存
    const cleanedProfile = cleanData({
      name: profile.name ?? existingProfile.name ?? '',
      title: profile.title ?? existingProfile.title ?? '',
      bio: profile.bio ?? existingProfile.bio ?? '',
      calendarEvents: profile.calendarEvents ?? existingProfile.calendarEvents ?? [],
      photos: profile.photos ?? existingProfile.photos ?? [],
      youtubeChannelId: profile.youtubeChannelId ?? existingProfile.youtubeChannelId ?? '',
      instagramPostUrl: profile.instagramPostUrl ?? existingProfile.instagramPostUrl ?? '',
      xUsername: profile.xUsername ?? existingProfile.xUsername ?? '',
      tiktokUrls: profile.tiktokUrls ?? existingProfile.tiktokUrls ?? [],
      youtubeMode: profile.youtubeMode ?? existingProfile.youtubeMode ?? 'latest',
      manualYouTubeUrls: profile.manualYouTubeUrls ?? existingProfile.manualYouTubeUrls ?? [],
      facebookUrl: profile.facebookUrl ?? existingProfile.facebookUrl ?? '',
    });

    await userRef.set({ profile: cleanedProfile }, { merge: true });
    return NextResponse.json({ message: 'User profile updated' });
  } catch (err) {
    console.error('🔥 Firestore保存エラー:', err);
    return NextResponse.json({ error: 'Firestore保存に失敗しました' }, { status: 500 });
  }
}
