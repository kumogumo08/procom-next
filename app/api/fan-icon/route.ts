import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { FAN_ACCOUNT_KIND, readUserAccountKind } from '@/lib/accountKind';
import { readUserSuspended } from '@/lib/accountSuspension';
import { rejectIfSuspended } from '@/lib/accountSuspensionGuard';
import { bucket, db, FieldValue } from '@/lib/firebase-admin';
import {
  FAN_ICON_FOLDER,
  FAN_ICON_MAX_BYTES,
  buildFanIconUrl,
  inspectFanIcon,
  isSafeFanIconObject,
  parseOwnedFanIcon,
} from '@/lib/fanIcon';
import { encodeFanIcon } from '@/lib/fanIconServer';
import { resolveVerifiedSession } from '@/lib/session';

export const runtime = 'nodejs';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

async function ownerUid(req: NextRequest): Promise<string | NextResponse> {
  const session = await resolveVerifiedSession(req);
  if (session instanceof NextResponse) return session;
  if (!session?.uid) {
    return NextResponse.json({ error: '未ログインです' }, { status: 401, headers: PRIVATE });
  }
  const suspended = await rejectIfSuspended(session.uid);
  if (suspended) return suspended;
  return session.uid;
}

function fanOnly(data: unknown): boolean {
  return readUserAccountKind(data) === FAN_ACCOUNT_KIND && (data as { deletionPending?: unknown }).deletionPending !== true;
}

async function removeOwnedIcon(uid: string, rawUrl: unknown, keepPath: string | null): Promise<void> {
  const parsed = parseOwnedFanIcon(rawUrl, uid, bucket.name);
  if (!parsed || parsed.objectPath === keepPath || !isSafeFanIconObject(uid, parsed.objectPath)) return;
  await bucket.file(parsed.objectPath).delete({ ignoreNotFound: true }).catch((err: unknown) => {
    console.error('fan icon cleanup', err instanceof Error ? err.name : 'error');
  });
}

export async function POST(req: NextRequest) {
  const uid = await ownerUid(req);
  if (uid instanceof NextResponse) return uid;

  let objectPath = '';
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルが無効です' }, { status: 400, headers: PRIVATE });
    }
    if (file.size <= 0 || file.size > FAN_ICON_MAX_BYTES) {
      return NextResponse.json({ error: '画像は2MB以下にしてください' }, { status: 413, headers: PRIVATE });
    }

    const input = Buffer.from(await file.arrayBuffer());
    const inspected = inspectFanIcon(file.type, input);
    if (!inspected.ok) {
      return NextResponse.json({ error: inspected.error }, { status: 400, headers: PRIVATE });
    }
    const existing = await db.collection('users').doc(uid).get();
    if (!existing.exists || !fanOnly(existing.data()) || readUserSuspended(existing.data())) {
      return NextResponse.json({ error: 'ファン会員だけアイコンを変更できます' }, { status: 403, headers: PRIVATE });
    }

    let encoded: Buffer;
    try {
      encoded = await encodeFanIcon(input);
    } catch {
      return NextResponse.json({ error: '画像の形式を確認できませんでした' }, { status: 400, headers: PRIVATE });
    }
    objectPath = `${FAN_ICON_FOLDER}/${uid}/${uuidv4()}.webp`;
    if (!isSafeFanIconObject(uid, objectPath)) {
      return NextResponse.json({ error: '画像を保存できません' }, { status: 400, headers: PRIVATE });
    }
    const token = uuidv4();
    const fanIconUrl = buildFanIconUrl(bucket.name, objectPath, token);
    if (!parseOwnedFanIcon(fanIconUrl, uid, bucket.name)) {
      return NextResponse.json({ error: '画像を保存できません' }, { status: 400, headers: PRIVATE });
    }

    await bucket.file(objectPath).save(encoded, {
      resumable: false,
      metadata: {
        contentType: 'image/webp',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const userRef = db.collection('users').doc(uid);
    let previous: unknown = null;
    try {
      previous = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists || !fanOnly(snap.data()) || readUserSuspended(snap.data())) {
          throw new Error('fan-icon-forbidden');
        }
        const current = snap.get('fanIconUrl');
        tx.update(userRef, { fanIconUrl });
        return current;
      });
    } catch (err: unknown) {
      await bucket.file(objectPath).delete({ ignoreNotFound: true }).catch(() => undefined);
      if (err instanceof Error && err.message === 'fan-icon-forbidden') {
        return NextResponse.json({ error: 'ファン会員だけアイコンを変更できます' }, { status: 403, headers: PRIVATE });
      }
      throw err;
    }

    await removeOwnedIcon(uid, previous, objectPath);
    return NextResponse.json({ fanIconUrl }, { headers: PRIVATE });
  } catch (err: unknown) {
    if (objectPath) {
      await bucket.file(objectPath).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    console.error('fan icon upload failed:', err instanceof Error ? err.name : 'error');
    return NextResponse.json({ error: '画像を保存できませんでした' }, { status: 500, headers: PRIVATE });
  }
}

export async function DELETE(req: NextRequest) {
  const uid = await ownerUid(req);
  if (uid instanceof NextResponse) return uid;

  try {
    const userRef = db.collection('users').doc(uid);
    const previous = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists || !fanOnly(snap.data()) || readUserSuspended(snap.data())) {
        throw new Error('fan-icon-forbidden');
      }
      const current = snap.get('fanIconUrl');
      tx.update(userRef, { fanIconUrl: FieldValue.delete() });
      return current;
    });
    await removeOwnedIcon(uid, previous, null);
    return NextResponse.json({ fanIconUrl: null }, { headers: PRIVATE });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'fan-icon-forbidden') {
      return NextResponse.json({ error: 'ファン会員だけアイコンを変更できます' }, { status: 403, headers: PRIVATE });
    }
    console.error('fan icon delete failed:', err instanceof Error ? err.name : 'error');
    return NextResponse.json({ error: '画像を削除できませんでした' }, { status: 500, headers: PRIVATE });
  }
}
