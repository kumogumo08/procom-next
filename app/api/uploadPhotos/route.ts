// app/api/uploadPhotos/route.ts
export const runtime = 'nodejs'; // ⬅️ 必ず入れる！

import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase';
import { schedulePhotoRetention } from '@/lib/photoGc';
import { rejectIfSuspended } from '@/lib/accountSuspensionGuard';
import { resolveSessionUid } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const uid = await resolveSessionUid(req);
  if (uid instanceof NextResponse) return uid;

  if (!uid) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401 });
  }
  const suspended = await rejectIfSuspended(uid);
  if (suspended) return suspended;

  try {
    const { base64Images } = await req.json();

    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      return NextResponse.json({ error: '画像配列が不正です' }, { status: 400 });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[uploadPhotos]', { uid, imageCount: base64Images.length });
    }

    const urls: string[] = [];

    for (const base64 of base64Images) {
      try {
        const matches = base64.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn('[uploadPhotos] invalid base64 item skipped');
          continue;
        }

        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = contentType.split('/')[1];
        const fileName = `photos/${uid}/${uuidv4()}.${ext}`;
        const token = uuidv4();
        const file = bucket.file(fileName);

        await file.save(buffer, {
          metadata: {
            contentType,
            metadata: { firebaseStorageDownloadTokens: token },
          },
        });

        try {
          await schedulePhotoRetention(uid, fileName);
        } catch (scheduleErr: unknown) {
          console.error('photo retention schedule failed:', scheduleErr instanceof Error ? scheduleErr.name : 'error');
          await file.delete({ ignoreNotFound: true }).catch(() => undefined);
          continue;
        }

        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
        urls.push(url);
      } catch (imgErr: any) {
        console.error('❌ 個別画像保存失敗:', imgErr?.message || imgErr);
      }
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: '画像の解析または保存に失敗しました' }, { status: 400 });
    }

    return NextResponse.json({ urls });
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error('❌ アップロード失敗:', message);

    return NextResponse.json(
      {
        error: 'アップロード失敗',
        details: message,
      },
      { status: 500 }
    );
  }
}

