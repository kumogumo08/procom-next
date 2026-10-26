import { NextRequest, NextResponse } from 'next/server';
import { assertRequiredProfile, confirmOwnedPhoto, readSetupActor, saveSetupDraft, SetupHttpError } from '@/lib/onboardingSetupServer';

export const runtime = 'nodejs';

/** 途中保存。onboardingStatus は変更しない。 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '入力内容が不正です' }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const uid = await readSetupActor(req, record.uid);
    await assertRequiredProfile(uid);
    const photoProvided = Object.prototype.hasOwnProperty.call(record, 'photoUrl');
    const photo = photoProvided ? await confirmOwnedPhoto(record.photoUrl, uid) : undefined;
    await saveSetupDraft(uid, record, photo?.url, photoProvided);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SetupHttpError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: error.status });
    }
    console.error('[profile setup draft]', error);
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}
