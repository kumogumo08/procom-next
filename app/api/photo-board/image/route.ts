import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import { rejectIfSuspended } from '@/lib/accountSuspensionGuard';
import { resolveVerifiedSession } from '@/lib/session';
import { inspectProductImage, PRODUCT_IMAGE_MAX_BYTES } from '@/lib/productGallery';
import {
  canonicalPhotoBoardImageUrl,
  isSafePhotoBoardObject,
  parseOwnedPhotoBoardImage,
  PHOTO_BOARD_FOLDER,
  photoBoardImagePaths,
} from '@/lib/photoBoard';
import { canUsePhotoBoard } from '@/lib/photoBoardAccess';
import { schedulePhotoBoardRetention } from '@/lib/photoGc';

export const runtime = 'nodejs';

initializeFirebaseAdmin();
const db = getFirestore();
const bucket = getStorage().bucket();

async function ownerUid(req: NextRequest): Promise<string | NextResponse> {
  const session = await resolveVerifiedSession(req);
  if (session instanceof NextResponse) return session;
  if (!session?.uid) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401 });
  }
  const suspended = await rejectIfSuspended(session.uid);
  if (suspended) return suspended;
  if (!canUsePhotoBoard(session.uid)) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  return session.uid;
}

export async function POST(req: NextRequest) {
  const uid = await ownerUid(req);
  if (uid instanceof NextResponse) return uid;

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルが無効です' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > PRODUCT_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます（3MB以下にしてください）' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const inspected = inspectProductImage(file.type, buffer);
    if (!inspected.ok) {
      return NextResponse.json({ error: inspected.error }, { status: 400 });
    }

    const objectPath = `${PHOTO_BOARD_FOLDER}/${uid}/${uuidv4()}.${inspected.ext}`;
    if (!isSafePhotoBoardObject(uid, objectPath)) {
      return NextResponse.json({ error: '画像を保存できません' }, { status: 400 });
    }
    const token = uuidv4();
    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      metadata: {
        contentType: inspected.contentType,
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const imageUrl = canonicalPhotoBoardImageUrl(
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`,
      uid,
      bucket.name
    );
    if (!imageUrl) {
      await bucket.file(objectPath).delete({ ignoreNotFound: true }).catch(() => undefined);
      return NextResponse.json({ error: '画像を保存できません' }, { status: 500 });
    }
    try {
      await schedulePhotoBoardRetention(uid, objectPath);
    } catch (scheduleErr: unknown) {
      console.error(
        'photo board retention schedule failed:',
        scheduleErr instanceof Error ? scheduleErr.name : 'error'
      );
      await bucket.file(objectPath).delete({ ignoreNotFound: true }).catch(() => undefined);
      return NextResponse.json({ error: '画像を保存できません' }, { status: 500 });
    }
    return NextResponse.json({ imageUrl });
  } catch (err: unknown) {
    console.error('photo board upload failed:', err instanceof Error ? err.name : 'error');
    return NextResponse.json({ error: '画像アップロードに失敗しました' }, { status: 500 });
  }
}

/** 保存済みプロフィールが参照していない、本人の PHOTO BOARD 画像だけを消す。 */
export async function DELETE(req: NextRequest) {
  const uid = await ownerUid(req);
  if (uid instanceof NextResponse) return uid;

  const body = (await req.json().catch(() => null)) as { imageUrl?: unknown } | null;
  const parsed = parseOwnedPhotoBoardImage(body?.imageUrl, uid, bucket.name);
  if (!parsed || !isSafePhotoBoardObject(uid, parsed.objectPath)) {
    return NextResponse.json({ error: '画像を確認できません' }, { status: 400 });
  }

  const snap = await db.collection('users').doc(uid).get();
  const referenced = photoBoardImagePaths(snap.get('profile.photoBoard'), uid, bucket.name);
  if (referenced.includes(parsed.objectPath)) {
    return NextResponse.json({ kept: true });
  }

  await bucket.file(parsed.objectPath).delete({ ignoreNotFound: true });
  return NextResponse.json({ deleted: true });
}
