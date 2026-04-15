// app/api/uploadPhotos/route.ts
export const runtime = 'nodejs'; // ⬅️ 必ず入れる！

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';
import type { SessionData } from '@/lib/session-types';
import { cookies } from 'next/headers';
import { bucket } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';


// ✅ セッションオプション
const sessionOptions: SessionOptions = {
  cookieName: 'procom_session',
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies(); // ✅ await 必須（Next.js 15以降）
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.uid) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401 });
  }
  const uid = session.uid;

  try {
    const { base64Images } = await req.json();

    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      return NextResponse.json({ error: '画像配列が不正です' }, { status: 400 });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[uploadPhotos]', { uid, imageCount: base64Images.length });
    }

    // 🔁 古い画像を削除
    const [files] = await bucket.getFiles({ prefix: `photos/${uid}/` });
    await Promise.all(files.map(file => file.delete().catch(() => null)));

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

        await bucket.file(fileName).save(buffer, {
          metadata: {
            contentType,
            metadata: { firebaseStorageDownloadTokens: token },
          },
        });

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

