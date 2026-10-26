import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/firebase';
import { assertRequiredProfile, commitSetup, readSetupActor, SetupHttpError, storeSetupImage } from '@/lib/onboardingSetupServer';
import { planSetupDraft } from '@/lib/onboardingSetup';

export const runtime = 'nodejs';

/** 本人の Storage に追加する。既存オブジェクトは削除しない。 */
export async function POST(req: NextRequest) {
  let createdPath = '';
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '入力内容が不正です' }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const uid = await readSetupActor(req, record.uid);
    await assertRequiredProfile(uid);
    const stored = await storeSetupImage(uid, record.image);
    createdPath = stored.objectPath;
    await commitSetup(uid, (profile) =>
      planSetupDraft({
        existingProfile: profile,
        sessionUid: uid,
        claimedUid: uid,
        bucketName: bucket.name,
        nameProvided: false,
        titleProvided: false,
        photoProvided: true,
        name: undefined,
        title: undefined,
        photoUrl: stored.url,
        photoExists: true,
      })
    );
    return NextResponse.json({ ok: true, url: stored.url });
  } catch (error) {
    if (createdPath) {
      await bucket.file(createdPath).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    if (error instanceof SetupHttpError) {
      return NextResponse.json({ error: error.message, field: error.field ?? 'photo' }, { status: error.status });
    }
    console.error('[profile setup photo]', error);
    return NextResponse.json({ error: '画像の保存に失敗しました' }, { status: 500 });
  }
}
