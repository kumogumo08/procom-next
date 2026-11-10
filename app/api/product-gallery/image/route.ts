import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { initializeFirebaseAdmin } from '@/lib/firebase';
import { rejectIfSuspended } from '@/lib/accountSuspensionGuard';
import { resolveVerifiedSession } from '@/lib/session';
import {
  canonicalProductImageUrl,
  inspectProductImage,
  isSafeProductGalleryObject,
  parseOwnedProductImage,
  PRODUCT_GALLERY_FOLDER,
  PRODUCT_IMAGE_MAX_BYTES,
  productImagePaths,
} from '@/lib/productGallery';

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

    const objectPath = `${PRODUCT_GALLERY_FOLDER}/${uid}/${uuidv4()}.${inspected.ext}`;
    if (!isSafeProductGalleryObject(uid, objectPath)) {
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

    const imageUrl = canonicalProductImageUrl(
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`,
      uid,
      bucket.name
    );
    if (!imageUrl) {
      await bucket.file(objectPath).delete({ ignoreNotFound: true }).catch(() => undefined);
      return NextResponse.json({ error: '画像を保存できません' }, { status: 500 });
    }
    return NextResponse.json({ imageUrl });
  } catch (err: unknown) {
    console.error('product gallery upload failed:', err instanceof Error ? err.name : 'error');
    return NextResponse.json({ error: '画像アップロードに失敗しました' }, { status: 500 });
  }
}

/** 公開中のプロフィールが参照していない、本人の商品画像だけを消す。 */
export async function DELETE(req: NextRequest) {
  const uid = await ownerUid(req);
  if (uid instanceof NextResponse) return uid;

  const body = (await req.json().catch(() => null)) as { imageUrl?: unknown } | null;
  const parsed = parseOwnedProductImage(body?.imageUrl, uid, bucket.name);
  if (!parsed || !isSafeProductGalleryObject(uid, parsed.objectPath)) {
    return NextResponse.json({ error: '画像を確認できません' }, { status: 400 });
  }

  const snap = await db.collection('users').doc(uid).get();
  const referenced = productImagePaths(snap.get('profile.productGallery'), uid, bucket.name);
  if (referenced.includes(parsed.objectPath)) {
    return NextResponse.json({ kept: true });
  }

  await bucket.file(parsed.objectPath).delete({ ignoreNotFound: true });
  return NextResponse.json({ deleted: true });
}
