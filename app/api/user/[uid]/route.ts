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
import admin from 'firebase-admin';
import { normalizeInstagramUrl } from '@/lib/sns';
import { noteUserListing } from '@/lib/listing/firestoreListing';
import { nextContentStamp, readContentUpdatedAtMs } from '@/lib/profileContent';
import {
  coerceAppsFromFirestore,
  sanitizeAppsArray,
  validateAppsHaveAtLeastOneStoreUrl,
  validateAppStoreUrlFields,
  validateRawAppsPayloadForProfile,
} from '@/lib/appProjects';
import { enrichAppsWithStoreIcons } from '@/lib/appIcons';
import { clampPhotoPositionY } from '@/lib/photoPosition';
import { mergeProfileSettings } from '@/lib/blockLayout';

initializeFirebaseAdmin();
const db = getFirestore();

const firestore = getFirestore();
const bucket = getStorage().bucket();

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * undefined のみ「今回の更新対象外」として落とす。
 * "" / [] / null / false は明示的な値として残す（ユーザーが空にした状態を保存するため）。
 */
function omitUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** 未送信 / undefined → 既存値。null / "" → 空文字で上書き */
function pickString(incoming: Record<string, unknown>, key: string, existing: unknown): string {
  if (!hasOwn(incoming, key) || incoming[key] === undefined) {
    return typeof existing === 'string' ? existing : '';
  }
  const value = incoming[key];
  if (value === null) return '';
  return typeof value === 'string' ? value : String(value);
}

/** 未送信 / undefined → 既存値。null / [] → 空配列で上書き */
function pickArray<T>(incoming: Record<string, unknown>, key: string, existing: unknown): T[] {
  if (!hasOwn(incoming, key) || incoming[key] === undefined) {
    return Array.isArray(existing) ? (existing as T[]) : [];
  }
  const value = incoming[key];
  if (value === null) return [];
  return Array.isArray(value) ? (value as T[]) : [];
}

// --- GET: プロフィール情報取得 ---
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await context.params;

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
          .map((p: any) => {
            if (typeof p === 'string') return { url: p, position: clampPhotoPositionY(undefined) };
            if (p?.url) {
              return {
                url: p.url,
                position: clampPhotoPositionY(p.position),
              };
            }
            return null;
          })
          .filter(Boolean) as { url: string; position: number }[]
      : [];

    // 🔧 instagramPostUrl の正規化
    const normalizedInstagramUrl = normalizeInstagramUrl(rawProfile.instagramPostUrl ?? '');

    const profile = {
      name: rawProfile.name ?? '',
      title: rawProfile.title ?? '',
      bio: rawProfile.bio ?? '',
      photos,
      youtubeChannelId: rawProfile.youtubeChannelId ?? '',
      instagramPostUrl: normalizedInstagramUrl ?? '', // ← 🔄 正規化されたURLを代入
      xUsername: rawProfile.xUsername ?? '',
      tiktokUrls: rawProfile.tiktokUrls ?? [],
      calendarEvents: rawProfile.calendarEvents ?? [],
      youtubeMode: rawProfile.youtubeMode ?? 'latest',
      manualYouTubeUrls: rawProfile.manualYouTubeUrls ?? [],
      facebookUrl: rawProfile.facebookUrl ?? '',
      facebookUsername: rawProfile.facebookUsername ?? '',
      settings: rawProfile.settings ?? {},
      bannerLinks: rawProfile.bannerLinks ?? [],
      emailForContact: rawProfile.emailForContact ?? '',
      apps: coerceAppsFromFirestore(rawProfile.apps),
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
    const skipStoreUrlValidation = incoming.skipStoreUrlValidation === true;

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
    const existingBannerLinks = existing.bannerLinks ?? [];

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
    } else if (profile.calendarEvents === null) {
      profile.calendarEvents = [];
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
          position: clampPhotoPositionY(existingProfile.photos?.[i]?.position),
        }));
      } else {
        profile.photos = nonBase64Photos.map((photo: any, i: number) => {
          const url = photo.url;
          let y = photo.position;
          if (typeof y !== 'number' || Number.isNaN(y)) {
            const ex = existingProfile.photos?.[i];
            if (ex && typeof ex === 'object' && typeof (ex as any).position === 'number') {
              y = (ex as any).position;
            }
          }
          return { url, position: clampPhotoPositionY(y) };
        });
      }
    }

    if (typeof profile.instagramPostUrl === 'string') {
      const normalized = normalizeInstagramUrl(profile.instagramPostUrl);
      if (normalized) {
        profile.instagramPostUrl = normalized;
      } else {
        profile.instagramPostUrl = ''; // 無効なURLなら空文字にしておく
      }
    }
    const appsFromPayload = Object.prototype.hasOwnProperty.call(profile, 'apps');
    const rawAppsForSanitize = appsFromPayload
      ? Array.isArray(profile.apps)
        ? profile.apps
        : profile.apps === null
          ? []
          : existingProfile.apps ?? []
      : existingProfile.apps ?? [];

    if (process.env.NODE_ENV !== 'production') {
      console.log('[user POST] profile.apps (incoming)', {
        appsFromPayload,
        incomingLen: Array.isArray(profile.apps) ? profile.apps.length : 'n/a',
      });
    }

    if (appsFromPayload && Array.isArray(profile.apps)) {
      const rawAppsErr = validateRawAppsPayloadForProfile(profile.apps);
      if (rawAppsErr) {
        return NextResponse.json({ error: rawAppsErr }, { status: 400 });
      }
    }

    const mergedApps = sanitizeAppsArray(rawAppsForSanitize, existingProfile.apps);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[user POST] mergedApps.length after sanitize', mergedApps.length);
    }

    if (!skipStoreUrlValidation) {
      const appsStoreErr = validateAppsHaveAtLeastOneStoreUrl(mergedApps);
      if (appsStoreErr) {
        return NextResponse.json({ error: appsStoreErr }, { status: 400 });
      }
      const shapeErr = validateAppStoreUrlFields(mergedApps);
      if (shapeErr) {
        return NextResponse.json({ error: shapeErr }, { status: 400 });
      }
    }

    let appsForSave = mergedApps;
    try {
      appsForSave = await enrichAppsWithStoreIcons(mergedApps);
    } catch (e) {
      console.warn('[user POST] enrichAppsWithStoreIcons failed, saving without icon updates', e);
      appsForSave = mergedApps;
    }

    // 🔄 プロフィール保存
    // undefined = 未更新（既存維持）。"" / [] / null = 明示的な空。false は settings に残す。
    // photos は上の既存処理どおり（空配列は既存維持）。apps は sanitize 済みを後付け。
    const incomingProfile = profile as Record<string, unknown>;
    const cleanedProfile = omitUndefined({
      name: pickString(incomingProfile, 'name', existingProfile.name),
      title: pickString(incomingProfile, 'title', existingProfile.title),
      bio: pickString(incomingProfile, 'bio', existingProfile.bio),
      calendarEvents: pickArray(incomingProfile, 'calendarEvents', existingProfile.calendarEvents),
      photos: Array.isArray(profile.photos) ? profile.photos : existingProfile.photos ?? [],
      youtubeChannelId: pickString(incomingProfile, 'youtubeChannelId', existingProfile.youtubeChannelId),
      instagramPostUrl: pickString(incomingProfile, 'instagramPostUrl', existingProfile.instagramPostUrl),
      xUsername: pickString(incomingProfile, 'xUsername', existingProfile.xUsername),
      tiktokUrls: pickArray<string>(incomingProfile, 'tiktokUrls', existingProfile.tiktokUrls),
      youtubeMode: profile.youtubeMode ?? existingProfile.youtubeMode ?? 'latest',
      manualYouTubeUrls: pickArray<string>(
        incomingProfile,
        'manualYouTubeUrls',
        existingProfile.manualYouTubeUrls
      ),
      facebookUrl: pickString(incomingProfile, 'facebookUrl', existingProfile.facebookUrl),
      facebookUsername: pickString(incomingProfile, 'facebookUsername', existingProfile.facebookUsername),
      bannerLinks: pickArray(incomingProfile, 'bannerLinks', existingProfile.bannerLinks),
      customLinks: pickArray(incomingProfile, 'customLinks', existingProfile.customLinks),
      emailForContact: pickString(incomingProfile, 'emailForContact', existingProfile.emailForContact),
      settings: mergeProfileSettings(existingProfile.settings, profile.settings),
    });

    cleanedProfile.apps = appsForSave;
    const stamp = nextContentStamp(existingProfile, cleanedProfile);
    const existingStamp = readContentUpdatedAtMs(existingProfile);
    if (stamp != null) cleanedProfile.contentUpdatedAtMs = stamp;
    else if (existingStamp != null) cleanedProfile.contentUpdatedAtMs = existingStamp;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[user POST] cleanedProfile.apps.length before Firestore', appsForSave.length);
    }

    await userRef.set({ profile: cleanedProfile }, { merge: true });
    await noteUserListing(uid);
    return NextResponse.json({ message: 'User profile updated', apps: appsForSave });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('🔥 Firestore保存エラー:', err);
    console.error('[user POST] exception message:', message);
    return NextResponse.json({ error: 'Firestore保存に失敗しました' }, { status: 500 });
  }
}
// --- PATCH: SNSボタンだけ保存 ---
// --- PATCH: 一部フィールドの更新（SNSボタンやカレンダーなど） ---
export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const uid = url.pathname.split('/').pop(); // /api/user/[uid] の uid を取得

    if (!uid) {
      return NextResponse.json({ error: 'uidが指定されていません' }, { status: 400 });
    }

    const session = await getIronSession<SessionData>(req, new NextResponse(), sessionOptions);
    if (!session?.uid || session.uid !== uid) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const body = await req.json();
    const updates: any = {};

    if (Array.isArray(body.customLinks)) {
      if (!updates.profile) updates.profile = {};
      updates.profile.customLinks = body.customLinks.filter(
        (link: { label?: string; url?: string }) => link.label && link.url
      );
    }

    if (Array.isArray(body.profile?.calendarEvents)) {
      const cleaned = body.profile.calendarEvents
        .filter((e: any) => typeof e === 'object' && e.date && Array.isArray(e.events))
        .map((e: any) => ({
          date: String(e.date),
          events: e.events.map(String),
        }));

      if (!updates.profile) updates.profile = {};
      updates.profile.calendarEvents = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(uid);
    const existingSnap = await userRef.get();
    const existingProfile =
      existingSnap.exists && existingSnap.data()?.profile && typeof existingSnap.data()?.profile === 'object'
        ? (existingSnap.data()?.profile as Record<string, unknown>)
        : {};
    const afterProfile: Record<string, unknown> = { ...existingProfile, ...updates.profile };
    const stamp = nextContentStamp(existingProfile, afterProfile);
    if (stamp != null) updates.profile.contentUpdatedAtMs = stamp;
    await userRef.set(updates, { merge: true });
    await noteUserListing(uid);

    return NextResponse.json({ message: 'プロフィールの一部を更新しました' });
  } catch (err) {
    console.error('❌ PATCHエラー:', err);
    return NextResponse.json({ error: 'PATCHエラーが発生しました' }, { status: 500 });
  }
}

